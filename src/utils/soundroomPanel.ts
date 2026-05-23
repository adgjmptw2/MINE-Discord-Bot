import {
  ActionRowBuilder,
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
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

function brand(client: MineClient): string {
  return client.config.soundroom?.brandName?.trim() || "마인";
}

function thinBar(currentMs: number, totalMs: number, width = 11): string {
  if (totalMs <= 0) {
    return "─".repeat(width);
  }
  const ratio = Math.max(0, Math.min(1, currentMs / totalMs));
  const on = Math.round(ratio * width);
  return `${"─".repeat(Math.max(0, on))}·${"─".repeat(Math.max(0, width - on - 1))}`;
}

function volumeLabel(volume: number): string {
  if (volume >= 80) {
    return "🔊 크게";
  }
  if (volume <= 20) {
    return "🔉 작게";
  }
  return "🔊 일반";
}

const footerTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function koreanFooterTime(): string {
  return `오늘 ${footerTimeFormat.format(new Date())}`;
}

export const SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC = 60 * 60;

export function shouldShowSoundroomMaintenanceNotice(): boolean {
  return process.uptime() < SOUNDROOM_MAINTENANCE_NOTICE_UPTIME_SEC;
}

export function getSoundroomMaintenanceNotice(): string | null {
  if (!shouldShowSoundroomMaintenanceNotice()) {
    return null;
  }
  return "-# 가동 후 1시간 이내에는 음악 기능이 불안정할 수 있습니다.";
}

function appendMaintenanceFooter(base: string): string {
  const n = getSoundroomMaintenanceNotice();
  if (!n) {
    return base;
  }
  return `${base}\n\n${n}`;
}

export function buildSoundroomIdlePayload(
  client: MineClient,
): BaseMessageOptions {
  const thumb = client.user?.displayAvatarURL({ size: 256 }) ?? undefined;
  const b = brand(client);

  const embed = new EmbedBuilder()
    .setTitle(`${b} 노래 채널`)
    .setColor(0x7c5cff)
    .setDescription(
      appendMaintenanceFooter(
        "채팅에 검색어 또는 유튜브 링크를 입력하면 재생됩니다.\n자동 재생은 재생 중 패널 버튼으로 켜고 끌 수 있습니다.",
      ),
    );
  if (thumb) {
    embed.setThumbnail(thumb);
  }

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
  };
}

export function buildSoundroomPlayingPayload(
  client: MineClient,
  player: ExtendedPlayer,
): BaseMessageOptions {
  const track = player.current!;
  const pos = player.position ?? 0;
  const len = track.info.length || 1;
  const volPct = Math.round(player.volume ?? 100);
  const bar = thinBar(pos, len);
  const thumb = track.info.thumbnail ?? null;

  const desc = appendMaintenanceFooter(
    [
      `[${track.info.title}](${track.info.uri})`,
      "",
      `${volumeLabel(player.volume ?? 100)} · 볼륨 ${volPct}%`,
      "",
      `(${formatDuration(pos)}) ${bar} (${formatDuration(len)})`,
    ].join("\n"),
  );

  const requester = track.info.requester?.user.username ?? "알 수 없음";

  const ap = getAutoplayState(player.guildId);
  const userQueued = countUserSoundroomQueue(player);

  const embed = new EmbedBuilder()
    .setTitle("지금 재생 중")
    .setColor(client.config.color)
    .setDescription(desc)
    .setFooter({
      text: `신청자: ${requester} | 볼륨: ${volPct}% • 자동 재생 ${ap.enabled ? "ON" : "OFF"} • ${koreanFooterTime()}`,
    });
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
  if (thumb) {
    embed.setThumbnail(thumb).setImage(thumb);
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("sr_stop")
      .setLabel("정지")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("sr_seek")
      .setLabel("구간 이동")
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

  await msg.edit(buildSoundroomIdlePayload(client));
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
