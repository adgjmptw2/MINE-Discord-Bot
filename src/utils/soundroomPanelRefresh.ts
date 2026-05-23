import { DiscordAPIError } from "@discordjs/rest";
import {
  PermissionFlagsBits,
  type BaseMessageOptions,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import { getPlayer } from "@/utils/commands";
import { log } from "@/utils/logger";
import {
  listSoundroomRecords,
  setSoundroom,
  type SoundroomRecord,
} from "@/storage/soundroom";
import type { MineClient } from "@/types";
import {
  buildSoundroomIdlePayload,
  buildSoundroomPlayingPayload,
  isSoundroomPanelMessage,
  shouldShowSoundroomMaintenanceNotice,
  SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC,
} from "@/utils/soundroomPanel";

const LIGHT_PANEL: { includeMedia: false } = { includeMedia: false };

const mentionNone = { parse: [] as const };

const STARTUP_REFRESH_DELAY_MS = 15_000;
const PER_GUILD_DELAY_MS = 1_000;
const MAX_TRANSIENT_ATTEMPTS = 3;

const UNKNOWN_CHANNEL = 10_003;
const UNKNOWN_MESSAGE = 10_008;
const MISSING_ACCESS = 50_001;
const MISSING_PERMISSIONS = 50_013;
const CANNOT_EDIT_OTHER_USER = 50_005;
const CANNOT_SEND_NON_TEXT = 50_008;
const INVALID_FORM_BODY = 50_035;

let startupRefreshScheduled = false;
let soundroomPanelReadyRefreshDone = false;

type RefreshResult = "edited" | "recreated" | "adopted" | "skipped" | "failed";

type RefreshStats = {
  edited: number;
  recreated: number;
  adopted: number;
  skipped: number;
  failed: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * 500);
}

function getErrorCode(error: unknown): number | string | undefined {
  if (error instanceof DiscordAPIError) {
    return error.code;
  }
  if (typeof error === "object" && error !== null) {
    const rec = error as Record<string, unknown>;
    if (typeof rec.code === "number" || typeof rec.code === "string") {
      return rec.code;
    }
    const cause = rec.cause;
    if (typeof cause === "object" && cause !== null) {
      const causeCode = (cause as Record<string, unknown>).code;
      if (typeof causeCode === "number" || typeof causeCode === "string") {
        return causeCode;
      }
    }
  }
  return undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof DiscordAPIError) {
    return error.status;
  }
  if (typeof error === "object" && error !== null) {
    const status = (error as Record<string, unknown>).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function getErrorMessageDeep(error: unknown): string {
  const parts: string[] = [];
  let e: unknown = error;
  for (let d = 0; d < 6 && e !== undefined && e !== null; d += 1) {
    if (e instanceof Error) {
      parts.push(e.message);
      e = e.cause;
      continue;
    }
    if (typeof e === "object" && "message" in (e as object)) {
      parts.push(String((e as { message: unknown }).message));
      e =
        "cause" in (e as object)
          ? (e as { cause: unknown }).cause
          : undefined;
      continue;
    }
    parts.push(String(e));
    break;
  }
  return parts.join(" | ").toLowerCase();
}

function getErrorMessageShort(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 140);
  }
  return String(error).slice(0, 140);
}

function logRefreshFailure(
  guildId: string,
  phase: string,
  error: unknown,
  elapsedMs?: number,
): void {
  const code = getErrorCode(error);
  const status = getErrorStatus(error);
  const message = getErrorMessageShort(error);
  const elapsed =
    elapsedMs !== undefined ? ` elapsedMs=${elapsedMs}` : "";
  log(
    "warn",
    "client",
    `Soundroom refresh failed guild=${guildId} phase=${phase} code=${String(code ?? "-")} status=${status ?? "-"}${elapsed} msg=${message}`,
  );
}

function isUnknownMessage(error: unknown): boolean {
  return getErrorCode(error) === UNKNOWN_MESSAGE;
}

function isPermanentNoAccess(error: unknown): boolean {
  const code = getErrorCode(error);
  return (
    code === UNKNOWN_CHANNEL ||
    code === MISSING_ACCESS ||
    code === MISSING_PERMISSIONS ||
    code === CANNOT_EDIT_OTHER_USER ||
    code === CANNOT_SEND_NON_TEXT
  );
}

function isInvalidPayload(error: unknown): boolean {
  return getErrorCode(error) === INVALID_FORM_BODY;
}

function isTransientRestError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 500) {
    return true;
  }
  const code = getErrorCode(error);
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_SOCKET"
  ) {
    return true;
  }
  const deep = getErrorMessageDeep(error);
  return (
    deep.includes("aborted") ||
    deep.includes("other side closed") ||
    deep.includes("socket") ||
    deep.includes("timeout") ||
    deep.includes("econnreset") ||
    deep.includes("etimedout")
  );
}

function getMaxTransientAttempts(phase: string): number {
  if (phase === "message-edit") {
    return 2;
  }
  return MAX_TRANSIENT_ATTEMPTS;
}

async function retryTransient<T>(
  guildId: string,
  phase: string,
  task: () => Promise<T>,
): Promise<T> {
  const maxAttempts = getMaxTransientAttempts(phase);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isTransientRestError(error)) {
        throw error;
      }
      if (attempt >= maxAttempts) {
        break;
      }
      const delay = jitter(1_500 * attempt * attempt);
      log(
        "warn",
        "client",
        `Soundroom transient retry guild=${guildId} phase=${phase} attempt=${attempt} delayMs=${delay} code=${String(getErrorCode(error) ?? "-")}`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

function isGuildTextChannelForMessages(
  ch: unknown,
): ch is GuildTextBasedChannel {
  return (
    typeof ch === "object" &&
    ch !== null &&
    "isTextBased" in ch &&
    typeof (ch as { isTextBased: () => boolean }).isTextBased === "function" &&
    (ch as { isTextBased: () => boolean }).isTextBased() &&
    "isDMBased" in ch &&
    typeof (ch as { isDMBased: () => boolean }).isDMBased === "function" &&
    !(ch as { isDMBased: () => boolean }).isDMBased() &&
    "messages" in ch
  );
}

function buildSoundroomPayloadForGuild(
  client: MineClient,
  guildId: string,
): BaseMessageOptions {
  const player = getPlayer(client, guildId);
  return player?.current
    ? buildSoundroomPlayingPayload(client, player, LIGHT_PANEL)
    : buildSoundroomIdlePayload(client, guildId, LIGHT_PANEL);
}

async function findExistingSoundroomPanel(
  channel: GuildTextBasedChannel,
  clientUserId: string,
): Promise<Message | null> {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    for (const message of messages.values()) {
      if (message.author.id !== clientUserId) {
        continue;
      }
      if (isSoundroomPanelMessage(message)) {
        return message;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function recreateOrAdoptPanel(
  client: MineClient,
  record: SoundroomRecord,
  channel: GuildTextBasedChannel,
): Promise<"recreated" | "adopted"> {
  const clientUserId = client.user?.id;
  if (!clientUserId) {
    throw new Error("missing client user");
  }

  const existing = await findExistingSoundroomPanel(channel, clientUserId);
  const payload = buildSoundroomPayloadForGuild(client, record.guildId);

  if (existing) {
    await retryTransient(record.guildId, "adopt-edit", () =>
      existing.edit({
        ...payload,
        allowedMentions: mentionNone,
      }),
    );
    setSoundroom(record.guildId, record.channelId, existing.id);
    return "adopted";
  }

  const sent = await retryTransient(record.guildId, "recreate-send", () =>
    channel.send({
      ...payload,
      allowedMentions: mentionNone,
    }),
  );
  setSoundroom(record.guildId, record.channelId, sent.id);
  return "recreated";
}

function channelNeedsAttachFiles(payload: BaseMessageOptions): boolean {
  return Boolean(payload.files && payload.files.length > 0);
}

async function refreshOneSoundroomPanel(
  client: MineClient,
  record: SoundroomRecord,
): Promise<RefreshResult> {
  const uid = client.user?.id;
  if (!uid) {
    return "skipped";
  }

  const guild = client.guilds.cache.get(record.guildId);
  if (!guild) {
    return "skipped";
  }

  const me = guild.members.me;
  if (!me) {
    return "skipped";
  }

  let channel: unknown;
  try {
    const fetched =
      guild.channels.cache.get(record.channelId) ??
      (await retryTransient(record.guildId, "channel-fetch", () =>
        guild.channels.fetch(record.channelId),
      ));
    if (!fetched) {
      return "skipped";
    }
    channel = fetched;
  } catch (error) {
    logRefreshFailure(record.guildId, "channel-fetch", error);
    return "failed";
  }

  if (!isGuildTextChannelForMessages(channel)) {
    return "skipped";
  }

  const payloadPreview = buildSoundroomPayloadForGuild(
    client,
    record.guildId,
  );
  const perms = channel.permissionsFor(me);
  let need =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks;
  if (channelNeedsAttachFiles(payloadPreview)) {
    need |= PermissionFlagsBits.AttachFiles;
  }
  if (!perms?.has(need)) {
    return "skipped";
  }

  const panelId = record.panelMessageId?.trim();
  if (!panelId) {
    try {
      return await recreateOrAdoptPanel(client, record, channel);
    } catch (error) {
      logRefreshFailure(record.guildId, "create-no-message-id", error);
      return "failed";
    }
  }

  let message: Message;
  try {
    message = await retryTransient(record.guildId, "message-fetch", () =>
      channel.messages.fetch(panelId),
    );
  } catch (error) {
    if (isUnknownMessage(error)) {
      try {
        return await recreateOrAdoptPanel(client, record, channel);
      } catch (recreateError) {
        logRefreshFailure(
          record.guildId,
          "recreate-after-unknown-message",
          recreateError,
        );
        return "failed";
      }
    }
    if (isPermanentNoAccess(error) || isInvalidPayload(error)) {
      logRefreshFailure(record.guildId, "message-fetch", error);
      return "failed";
    }
    logRefreshFailure(record.guildId, "message-fetch", error);
    return "failed";
  }

  if (message.author.id !== uid) {
    try {
      return await recreateOrAdoptPanel(client, record, channel);
    } catch (error) {
      logRefreshFailure(record.guildId, "recreate-not-own-message", error);
      return "failed";
    }
  }

  if (!message.editable) {
    log(
      "warn",
      "client",
      `Soundroom refresh not editable guild=${record.guildId}`,
    );
    return "failed";
  }

  const payload = buildSoundroomPayloadForGuild(client, record.guildId);

  const t0 = performance.now();
  try {
    await retryTransient(record.guildId, "message-edit", () =>
      message.edit({
        ...payload,
        allowedMentions: mentionNone,
      }),
    );
    return "edited";
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - t0);
    if (isUnknownMessage(error)) {
      try {
        return await recreateOrAdoptPanel(client, record, channel);
      } catch (recreateError) {
        logRefreshFailure(
          record.guildId,
          "recreate-after-edit-unknown",
          recreateError,
        );
        return "failed";
      }
    }
    if (isPermanentNoAccess(error) || isInvalidPayload(error)) {
      logRefreshFailure(
        record.guildId,
        "message-edit",
        error,
        elapsedMs,
      );
      return "failed";
    }
    logRefreshFailure(record.guildId, "message-edit", error, elapsedMs);
    return "failed";
  }
}

async function runSoundroomPanelRefreshPass(
  client: MineClient,
): Promise<RefreshStats> {
  const stats: RefreshStats = {
    edited: 0,
    recreated: 0,
    adopted: 0,
    skipped: 0,
    failed: 0,
  };

  const records = listSoundroomRecords().filter((r) =>
    client.guilds.cache.has(r.guildId),
  );

  log(
    "info",
    "client",
    `Soundroom ready refresh start count=${records.length}`,
  );

  for (const record of records) {
    const result = await refreshOneSoundroomPanel(client, record);
    stats[result] += 1;
    await sleep(jitter(PER_GUILD_DELAY_MS));
  }

  log(
    "info",
    "client",
    `Soundroom ready refresh done edited=${stats.edited} recreated=${stats.recreated} adopted=${stats.adopted} skipped=${stats.skipped} failed=${stats.failed}`,
  );

  return stats;
}

function scheduleSoundroomPanelNoticeRemoval(client: MineClient): void {
  if (!shouldShowSoundroomMaintenanceNotice()) {
    return;
  }
  const msUntil = Math.ceil(
    SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC * 1000 - process.uptime() * 1000,
  );
  if (msUntil <= 0) {
    return;
  }
  setTimeout(() => {
    void (async () => {
      try {
        const s = await runSoundroomPanelRefreshPass(client);
        log(
          "info",
          "client",
          `Soundroom panel notice expiry: edited ${s.edited}, recreated ${s.recreated}, adopted ${s.adopted}, skipped ${s.skipped}, failed ${s.failed}`,
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        log("warn", "client", `Soundroom panel notice expiry: ${m}`);
      }
    })();
  }, msUntil);
}

export function scheduleSoundroomReadyRefresh(client: MineClient): void {
  if (startupRefreshScheduled) {
    return;
  }
  startupRefreshScheduled = true;

  setTimeout(() => {
    void refreshSoundroomPanelsOnReady(client).catch((error) => {
      log(
        "warn",
        "client",
        `Soundroom ready refresh crashed code=${String(getErrorCode(error) ?? "-")} msg=${getErrorMessageShort(error)}`,
      );
    });
  }, STARTUP_REFRESH_DELAY_MS);
}

export async function refreshSoundroomPanelsOnReady(
  client: MineClient,
): Promise<void> {
  if (soundroomPanelReadyRefreshDone) {
    return;
  }
  if (!client.user?.id) {
    return;
  }
  soundroomPanelReadyRefreshDone = true;

  log("info", "client", "Refreshing Soundroom panels...");
  try {
    await runSoundroomPanelRefreshPass(client);
    scheduleSoundroomPanelNoticeRemoval(client);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    log("warn", "client", `Soundroom panel refresh: ${m}`);
  }
}
