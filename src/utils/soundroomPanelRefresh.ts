import { PermissionFlagsBits } from "discord.js";
import { getPlayer } from "@/utils/commands";
import { log } from "@/utils/logger";
import { listSoundroomRecords, setSoundroom } from "@/storage/soundroom";
import type { MineClient } from "@/types";
import {
  buildSoundroomIdlePayload,
  buildSoundroomPlayingPayload,
  fetchSoundroomPanelMessage,
  shouldShowSoundroomMaintenanceNotice,
  SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC,
} from "@/utils/soundroomPanel";

let soundroomPanelReadyRefreshDone = false;

const mentionNone = { parse: [] as const };

type PanelPassStats = {
  edited: number;
  recreated: number;
  skipped: number;
  failed: number;
};

async function applySoundroomPanelStateToAllGuilds(
  client: MineClient,
): Promise<PanelPassStats> {
  const uid = client.user?.id;
  const stats: PanelPassStats = {
    edited: 0,
    recreated: 0,
    skipped: 0,
    failed: 0,
  };
  if (!uid) {
    return stats;
  }

  const rooms = listSoundroomRecords();
  for (const room of rooms) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 350);
    });
    try {
      const guild =
        client.guilds.cache.get(room.guildId) ??
        (await client.guilds.fetch(room.guildId).catch(() => null));
      if (!guild) {
        stats.skipped += 1;
        continue;
      }

      const me = guild.members.me;
      if (!me) {
        stats.skipped += 1;
        continue;
      }

      const ch =
        guild.channels.cache.get(room.channelId) ??
        (await guild.channels.fetch(room.channelId).catch(() => null));
      if (!ch?.isTextBased() || ch.isDMBased()) {
        stats.skipped += 1;
        continue;
      }

      const perms = ch.permissionsFor(me);
      const need =
        PermissionFlagsBits.ViewChannel |
        PermissionFlagsBits.SendMessages |
        PermissionFlagsBits.EmbedLinks;
      if (!perms?.has(need)) {
        stats.skipped += 1;
        continue;
      }

      const player = getPlayer(client, room.guildId);
      const payload = player?.current
        ? buildSoundroomPlayingPayload(client, player)
        : buildSoundroomIdlePayload(client);

      const msg = await fetchSoundroomPanelMessage(client, room.guildId);

      if (msg) {
        if (!msg.editable || msg.author.id !== uid) {
          stats.failed += 1;
          continue;
        }
        try {
          await msg.edit({ ...payload, allowedMentions: mentionNone });
          stats.edited += 1;
        } catch {
          stats.failed += 1;
        }
      } else {
        try {
          const sent = await ch.send({
            ...payload,
            allowedMentions: mentionNone,
          });
          setSoundroom(room.guildId, ch.id, sent.id);
          stats.recreated += 1;
        } catch {
          stats.failed += 1;
        }
      }
    } catch {
      stats.failed += 1;
    }
  }
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
        const s = await applySoundroomPanelStateToAllGuilds(client);
        log(
          "info",
          "client",
          `Soundroom panel notice expiry: edited ${s.edited}, recreated ${s.recreated}, skipped ${s.skipped}, failed ${s.failed}`,
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        log("warn", "client", `Soundroom panel notice expiry: ${m}`);
      }
    })();
  }, msUntil);
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
    const s = await applySoundroomPanelStateToAllGuilds(client);
    log(
      "info",
      "client",
      `Soundroom panel refresh done: edited ${s.edited}, recreated ${s.recreated}, skipped ${s.skipped}, failed ${s.failed}`,
    );
    scheduleSoundroomPanelNoticeRemoval(client);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    log("warn", "client", `Soundroom panel refresh: ${m}`);
  }
}
