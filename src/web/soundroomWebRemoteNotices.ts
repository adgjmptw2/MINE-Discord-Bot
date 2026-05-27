import { getAutoplayState } from "@/utils/soundroomAutoplay";
import { getPlayer } from "@/utils/commands";
import { sendWebRemoteNotice } from "@/web/soundroomChannelNotice";
import type { SoundroomControlAction } from "@/web/types";
import type { ExtendedPlayer, MineClient } from "@/types";

const TITLE_MAX_LEN = 60;

function truncateTitle(title: string): string {
  const t = title.trim() || "제목 없음";
  if (t.length <= TITLE_MAX_LEN) {
    return t;
  }
  return `${t.slice(0, TITLE_MAX_LEN - 1)}…`;
}

export function buildWebRemoteTrackAddNotice(trackTitle: string): string {
  return `곡을 대기열에 추가: ${truncateTitle(trackTitle)}`;
}

export function buildWebRemoteSavedPlaylistAddNotice(
  addedCount: number,
  truncated: boolean,
): string {
  if (truncated) {
    return `저장된 플레이리스트 ${addedCount}곡을 대기열에 추가 (일부 곡은 제한으로 제외)`;
  }
  return `저장된 플레이리스트 ${addedCount}곡을 대기열에 추가`;
}

export function buildWebRemotePlaylistAddNotice(
  addedCount: number,
  truncated: boolean,
): string {
  if (truncated) {
    return `재생목록 ${addedCount}곡을 대기열에 추가 (일부 곡은 제한으로 제외)`;
  }
  return `재생목록 ${addedCount}곡을 대기열에 추가`;
}

export function buildWebRemoteQueueRemoveNotice(trackTitle: string): string {
  return `대기열에서 곡을 제거: ${truncateTitle(trackTitle)}`;
}

export async function sendWebRemoteControlNotice(
  client: MineClient,
  guildId: string,
  userId: string,
  action: SoundroomControlAction,
  player: ExtendedPlayer,
  volume?: number,
  autoplayEnabled?: boolean,
): Promise<void> {
  let actionText: string;
  switch (action) {
    case "togglePause":
      actionText = player.paused
        ? "재생을 일시정지"
        : "재생을 다시 시작";
      break;
    case "skip":
      actionText = "현재 곡을 스킵";
      break;
    case "stop":
      actionText = "재생을 정지하고 대기열을 비움";
      break;
    case "setVolume":
      actionText =
        typeof volume === "number"
          ? `볼륨을 ${volume}%로 변경`
          : "볼륨을 변경";
      break;
    case "toggleAutoplay": {
      const enabled =
        typeof autoplayEnabled === "boolean"
          ? autoplayEnabled
          : getAutoplayState(guildId).enabled;
      actionText = enabled ? "자동재생을 켬" : "자동재생을 끔";
      break;
    }
    default:
      return;
  }
  await sendWebRemoteNotice(client, guildId, userId, actionText);
}

export async function sendWebRemoteControlNoticeAfterAction(
  client: MineClient,
  guildId: string,
  userId: string,
  action: SoundroomControlAction,
  volume?: number,
  autoplayEnabled?: boolean,
): Promise<void> {
  if (action === "stop") {
    await sendWebRemoteNotice(
      client,
      guildId,
      userId,
      "재생을 정지하고 대기열을 비움",
    );
    return;
  }
  if (action === "skip") {
    await sendWebRemoteNotice(client, guildId, userId, "현재 곡을 스킵");
    return;
  }

  const player = getPlayer(client, guildId);
  if (!player && action !== "toggleAutoplay") {
    return;
  }
  if (action === "toggleAutoplay") {
    await sendWebRemoteControlNotice(
      client,
      guildId,
      userId,
      action,
      player ?? ({} as ExtendedPlayer),
      volume,
      autoplayEnabled,
    );
    return;
  }
  await sendWebRemoteControlNotice(
    client,
    guildId,
    userId,
    action,
    player!,
    volume,
    autoplayEnabled,
  );
}
