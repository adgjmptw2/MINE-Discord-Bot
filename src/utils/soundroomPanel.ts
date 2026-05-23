import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
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
): BaseMessageOptions {
  const idleUrl = getSoundroomIdleImageUrlFromEnv();
  const attachment = idleUrl ? null : tryLoadSoundroomIdleAttachment();

  const embed = new EmbedBuilder()
    .setTitle("🎵 MINE Soundroom")
    .setColor(0x7c5cff)
    .setDescription("노래 제목이나 URL을 입력하면 재생됩니다.");

  if (idleUrl) {
    embed.setImage(idleUrl);
  } else if (attachment) {
    embed.setImage(`attachment://${SOUNDROOM_IDLE_ATTACHMENT_NAME}`);
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

  const files: AttachmentBuilder[] = idleUrl ? [] : attachment ? [attachment] : [];

  return {
    embeds: [embed],
    components: [row1],
    allowedMentions: MENTION_NONE,
    files,
  };
}

export function buildSoundroomPlayingPayload(
  client: MineClient,
  player: ExtendedPlayer,
): BaseMessageOptions {
  const track = player.current!;
  const pos = player.position ?? 0;
  const len = track.info.length > 0 ? track.info.length : 1;
  const volPct = Math.round(player.volume ?? 100);
  const ap = getAutoplayState(player.guildId);
  const userQueued = countUserSoundroomQueue(player);

  const req = track.info.requester;
  const uid = req?.user?.id ?? req?.id;
  const reqMention = uid ? `<@${uid}>` : "알 수 없음";

  const embed = new EmbedBuilder()
    .setTitle("🎵 지금 재생 중")
    .setColor(client.config.color)
    .setDescription(`**${truncate(track.info.title || "제목 없음", 240)}**`);

  const { imageUrl: panelImageUrl, files: panelFiles } =
    resolveSoundroomPanelPlayingImage(track);
  if (panelImageUrl) {
    embed.setImage(panelImageUrl);
  }

  if (ap.enabled) {
    if (userQueued === 0) {
      const nextAp = player.queue.find(isSoundroomAutoplayTrack);
      const hintTitle =
        nextAp?.info.title?.trim() || ap.autoplayNextHintTitle?.trim() || "";
      const hintLine = hintTitle ? truncate(hintTitle, 90) : "—";
      embed.addFields({
        name: "대기열",
        value: `대기열이 비어있습니다.\n자동 재생 예정: ${hintLine}`,
        inline: false,
      });
    }
  } else if (userQueued === 0 && player.queue.length === 0) {
    embed.addFields({
      name: "대기열",
      value:
        "다음 곡이 없습니다. 재생이 끝난 뒤 1분이 지나면 음성 채널에서 나갑니다.",
      inline: false,
    });
  }

  const metaLines = [
    `신청자: ${reqMention} · 볼륨: ${volPct}% · 자동 재생: ${ap.enabled ? "ON" : "OFF"}`,
    formatSoundroomProgress(pos, len, track.info.isStream),
  ];
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
    files: panelFiles,
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
): Promise<void> {
  const msg = await fetchSoundroomPanelMessage(client, guildId);
  if (!msg?.editable) {
    return;
  }

  await msg.edit(buildSoundroomIdlePayload(client, guildId));
}

export async function editSoundroomPlayingPanel(
  client: MineClient,
  guildId: string,
): Promise<void> {
  const player = getPlayer(client, guildId);
  if (!player?.current) {
    return;
  }

  const msg = await fetchSoundroomPanelMessage(client, guildId);
  if (!msg?.editable) {
    return;
  }

  await msg.edit(buildSoundroomPlayingPayload(client, player));
}

export async function sendSoundroomAddNotification(
  channel: GuildTextBasedChannel,
  track: ExtendedTrack,
  volumePercent: number,
  /** 재생목록(플레이리스트)으로 여러 곡이 한 번에 들어갈 때 총 곡 수 */
  playlistTotalTracks?: number,
  /** Lavalink가 알려 준 재생목록 이름 (없으면 제목만 숫자로 표시) */
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
