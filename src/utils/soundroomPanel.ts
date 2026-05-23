import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type GuildMember,
  type Message,
  type BaseMessageOptions,
  type GuildTextBasedChannel,
} from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import { formatDuration, truncate } from "@/utils/discord";
import { getPlayer } from "@/utils/commands";
import {
  countUserSoundroomQueue,
  getAutoplayState,
  isSoundroomAutoplayTrack,
} from "@/utils/soundroomAutoplay";
import {
  formatSoundroomProgress,
  getSoundroomIdleImageUrlFromEnv,
  resolveSoundroomPanelPlayingImage,
  SOUNDROOM_IDLE_ATTACHMENT_NAME,
  tryLoadSoundroomIdleAttachment,
} from "@/utils/soundroomArtwork";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

const MENTION_NONE = { parse: [] as const };

function formatSoundroomRequesterDisplay(requester?: GuildMember): string {
  const uid = requester?.user?.id ?? requester?.id;
  if (uid) {
    return `<@${uid}>`;
  }
  if (!requester) {
    return "알 수 없음";
  }
  const display = requester.displayName?.trim();
  if (display) {
    return truncate(display, 48);
  }
  const username = requester.user?.username?.trim();
  if (username) {
    return truncate(username, 48);
  }
  return "알 수 없음";
}

export type BuildSoundroomPanelOptions = {
  includeMedia?: boolean;
  skipLocalIdleAttachment?: boolean;
};

export function isSoundroomPanelMessage(message: Message): boolean {
  if (!message.components?.length) {
    return false;
  }
  for (const row of message.components) {
    if (row.type !== ComponentType.ActionRow) {
      continue;
    }
    for (const comp of row.components) {
      if (
        comp.type === ComponentType.Button &&
        "customId" in comp &&
        typeof comp.customId === "string" &&
        comp.customId.startsWith("sr_")
      ) {
        return true;
      }
    }
  }
  return false;
}

export const SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC = 2 * 60 * 60;

export function shouldShowSoundroomMaintenanceNotice(): boolean {
  return process.uptime() < SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC;
}

export function getSoundroomMaintenanceNotice(): string | null {
  if (!shouldShowSoundroomMaintenanceNotice()) {
    return null;
  }
  return "-# 현재 점검중이라 음악 기능이 불안정할 수 있습니다.";
}

export function buildSoundroomIdlePayload(
  client: MineClient,
  guildId?: string,
  options?: BuildSoundroomPanelOptions,
): BaseMessageOptions {
  const includeMedia = options?.includeMedia !== false;

  const embed = new EmbedBuilder()
    .setTitle("🎵 MINE Soundroom")
    .setColor(0x7c5cff)
    .setDescription("노래 제목이나 URL을 입력하면 재생됩니다.");

  let files: AttachmentBuilder[] = [];

  if (includeMedia) {
    const idleUrl = getSoundroomIdleImageUrlFromEnv();
    if (idleUrl) {
      embed.setImage(idleUrl);
    } else if (!options?.skipLocalIdleAttachment) {
      const attachment = tryLoadSoundroomIdleAttachment();
      if (attachment) {
        embed.setImage(`attachment://${SOUNDROOM_IDLE_ATTACHMENT_NAME}`);
        files = [attachment];
      }
    }
  }

  let queueCount = 0;
  if (guildId) {
    const p = getPlayer(client, guildId);
    queueCount = p?.queue?.length ?? 0;
  }

  const metaLines = ["상태: 대기 중", `대기열: ${queueCount}곡`];
  const maint = getSoundroomMaintenanceNotice();
  if (maint) {
    metaLines.push(maint);
  }
  embed.addFields({
    name: "\u200b",
    value: metaLines.join("\n"),
    inline: false,
  });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("sr_recent")
      .setLabel("최근 재생")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("sr_melon")
      .setLabel("인기차트")
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [embed],
    components: [row1],
    allowedMentions: MENTION_NONE,
    files: includeMedia ? files : [],
  };
}

export function buildSoundroomPlayingPayload(
  client: MineClient,
  player: ExtendedPlayer,
  options?: BuildSoundroomPanelOptions,
): BaseMessageOptions {
  const includeMedia = options?.includeMedia !== false;
  const track = player.current!;
  const pos = player.position ?? 0;
  const len = track.info.length > 0 ? track.info.length : 1;
  const volPct = Math.round(player.volume ?? 100);
  const ap = getAutoplayState(player.guildId);
  const userQueued = countUserSoundroomQueue(player);

  const requesterDisp = formatSoundroomRequesterDisplay(track.info.requester);

  const embed = new EmbedBuilder()
    .setTitle("🎵 지금 재생 중")
    .setColor(client.config.color);

  const titleLine = `**${truncate(track.info.title || "제목 없음", 240)}**`;

  const queueHintLines: string[] = [];
  if (ap.enabled) {
    if (userQueued === 0) {
      const nextAp = player.queue.find(isSoundroomAutoplayTrack);
      const hintTitle =
        nextAp?.info.title?.trim() || ap.autoplayNextHintTitle?.trim() || "";
      const hintLine = hintTitle ? truncate(hintTitle, 72) : "—";
      queueHintLines.push(
        `**대기열**\n비어 있음 · 자동 재생 예정: ${hintLine}`,
      );
    }
  } else if (userQueued === 0 && player.queue.length === 0) {
    queueHintLines.push(
      "**대기열**\n다음 곡 없음 · 종료 후 1분 뒤 음성 채널에서 나갑니다.",
    );
  }

  const descParts: string[] = [titleLine];
  if (queueHintLines.length > 0) {
    descParts.push("", queueHintLines.join("\n\n"));
  }
  descParts.push(
    "",
    `신청자: ${requesterDisp} · 볼륨: ${volPct}% · 자동 재생: ${ap.enabled ? "ON" : "OFF"}`,
    formatSoundroomProgress(pos, len, track.info.isStream),
  );
  const maint = getSoundroomMaintenanceNotice();
  if (maint) {
    descParts.push("", maint);
  }

  let description = descParts.join("\n");
  if (description.length > 4096) {
    description = `${description.slice(0, 4093)}…`;
  }
  embed.setDescription(description);

  let panelFiles: AttachmentBuilder[] = [];
  if (includeMedia) {
    const { imageUrl: panelImageUrl, files } =
      resolveSoundroomPanelPlayingImage(track);
    panelFiles = files;
    if (panelImageUrl) {
      embed.setImage(panelImageUrl);
    }
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("sr_stop")
      .setLabel("정지")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("sr_seek")
      .setLabel("구간이동")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("sr_pause")
      .setLabel(player.paused ? "재생" : "일시정지")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("sr_skip")
      .setLabel("스킵")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("sr_queue")
      .setLabel("대기열")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("sr_autoplay_toggle")
      .setLabel(ap.enabled ? "자동 재생 ON" : "자동 재생 OFF")
      .setStyle(ap.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
  );

  return {
    embeds: [embed],
    components: [row1, row2],
    allowedMentions: MENTION_NONE,
    files: includeMedia ? panelFiles : [],
  };
}

export async function fetchSoundroomPanelMessage(
  client: MineClient,
  guildId: string,
): Promise<Message | null> {
  const room = getSoundroom(guildId);
  if (!room) {
    return null;
  }

  const cachedChannel = client.channels.cache.get(room.channelId);
  const channel =
    cachedChannel ??
    (await client.channels.fetch(room.channelId).catch(() => null));
  if (!channel?.isTextBased() || channel.isDMBased()) {
    return null;
  }

  const cachedMessage = channel.messages.cache.get(room.panelMessageId);
  if (cachedMessage) {
    return cachedMessage;
  }

  return channel.messages.fetch(room.panelMessageId).catch(() => null);
}

export async function editSoundroomIdlePanel(
  client: MineClient,
  guildId: string,
  options?: BuildSoundroomPanelOptions,
): Promise<void> {
  const msg = await fetchSoundroomPanelMessage(client, guildId);
  if (!msg?.editable) {
    return;
  }

  await msg.edit(buildSoundroomIdlePayload(client, guildId, options));
}

export async function editSoundroomPlayingPanel(
  client: MineClient,
  guildId: string,
  options?: BuildSoundroomPanelOptions,
): Promise<void> {
  const player = getPlayer(client, guildId);
  if (!player?.current) {
    return;
  }

  const msg = await fetchSoundroomPanelMessage(client, guildId);
  if (!msg?.editable) {
    return;
  }

  await msg.edit(buildSoundroomPlayingPayload(client, player, options));
}

export async function sendSoundroomAddNotification(
  channel: GuildTextBasedChannel,
  track: ExtendedTrack,
  volumePercent: number,
  playlistTotalTracks?: number,
  playlistName?: string | null,
): Promise<void> {
  const isPlaylist =
    playlistTotalTracks !== undefined && playlistTotalTracks > 1;
  const name = playlistName?.trim();

  const embed = new EmbedBuilder().setColor(0x5865f2);

  if (isPlaylist) {
    embed
      .setTitle(
        name
          ? `${name} · ${playlistTotalTracks}곡`
          : `재생 목록 · ${playlistTotalTracks}곡`,
      )
      .setDescription(
        `**첫 곡:** [${track.info.title}](${track.info.uri}) (${formatDuration(track.info.length)})`,
      );
  } else {
    embed
      .setTitle("재생 목록에 추가됨")
      .setDescription(
        `[${track.info.title}](${track.info.uri}) (${formatDuration(track.info.length)})`,
      );
  }

  embed.setThumbnail(track.info.thumbnail ?? null).setFooter({
    text: `재생이 끊기면 Lavalink·네트워크 설정을 확인해 주세요. | 볼륨: ${volumePercent}%`,
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("sr_pick_alt")
      .setLabel("다른 결과")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("sr_error_log")
      .setLabel("오류 기록")
      .setStyle(ButtonStyle.Secondary),
  );

  const sent = await channel.send({ embeds: [embed], components: [row] });
  setTimeout(() => {
    void sent.delete().catch(() => undefined);
  }, 15_000);
}
