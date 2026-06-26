import { getSoundroom } from "@/storage/soundroom";
import type { MineClient } from "@/types";

export const WEB_REMOTE_NOTICE_DELETE_MS = 30_000;
const TITLE_MAX_LEN = 60;

// allowedMentions parse [] — 멘션 텍스트만, 알림 없음
const MENTION_NONE = { parse: [] as const };

function truncateTitle(title: string): string {
  const t = title.trim() || "제목 없음";
  if (t.length <= TITLE_MAX_LEN) {
    return t;
  }
  return `${t.slice(0, TITLE_MAX_LEN - 1)}…`;
}

export function buildWebRemoteNoticeContent(
  userId: string,
  actionText: string,
): string {
  return `<@${userId}>님이 웹 리모컨으로 **${actionText}**하였습니다.`;
}

export function buildSoundroomPlaylistAddNoticeContent(
  userId: string,
  playlistTitle: string,
): string {
  const title = truncateTitle(playlistTitle);
  return `<@${userId}>님이 플레이리스트 **${title}**를 추가하였습니다.`;
}

export function scheduleGuildChannelMessageDelete(
  client: MineClient,
  channelId: string,
  messageId: string,
  delayMs: number = WEB_REMOTE_NOTICE_DELETE_MS,
): void {
  setTimeout(() => {
    void (async () => {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          return;
        }
        const msg = await channel.messages.fetch(messageId);
        if (msg.deletable) {
          await msg.delete();
        }
      } catch {}
    })();
  }, delayMs);
}

function scheduleNoticeDelete(
  client: MineClient,
  channelId: string,
  message: { id: string; delete: () => Promise<unknown> },
): void {
  scheduleGuildChannelMessageDelete(client, channelId, message.id);
  setTimeout(() => {
    void message.delete().catch(() => undefined);
  }, WEB_REMOTE_NOTICE_DELETE_MS);
}

export async function sendWebRemoteNotice(
  client: MineClient,
  guildId: string,
  userId: string,
  actionText: string,
): Promise<void> {
  try {
    const room = getSoundroom(guildId);
    if (!room?.channelId) {
      return;
    }

    const channel = await client.channels.fetch(room.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      return;
    }

    const content = buildWebRemoteNoticeContent(userId, actionText);
    const message = await channel.send({
      content,
      allowedMentions: MENTION_NONE,
    });
    scheduleNoticeDelete(client, room.channelId, message);
  } catch {}
}

export async function sendSoundroomPlaylistAddNotice(
  client: MineClient,
  guildId: string,
  userId: string,
  playlistTitle: string,
): Promise<void> {
  try {
    const room = getSoundroom(guildId);
    if (!room?.channelId) {
      return;
    }

    const channel = await client.channels.fetch(room.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      return;
    }

    const content = buildSoundroomPlaylistAddNoticeContent(
      userId,
      playlistTitle,
    );
    const message = await channel.send({
      content,
      allowedMentions: MENTION_NONE,
    });
    scheduleNoticeDelete(client, room.channelId, message);
  } catch {}
}

export async function sendWebRemoteQueueSwapNotice(
  client: MineClient,
  guildId: string,
  actorUserId: string,
  fromQueueIndex: number,
  fromTitle: string,
  toQueueIndex: number,
  toTitle: string,
): Promise<void> {
  const fromLabel = `${fromQueueIndex + 1}. ${truncateTitle(fromTitle)}`;
  const toLabel = `${toQueueIndex + 1}. ${truncateTitle(toTitle)}`;
  const actionText = `대기열 순서를 변경: ${fromLabel} ↔ ${toLabel}`;
  await sendWebRemoteNotice(client, guildId, actorUserId, actionText);
}

export async function sendWebRemoteQueueShuffleNotice(
  client: MineClient,
  guildId: string,
  actorUserId: string,
  shuffledCount: number,
): Promise<void> {
  const actionText = `대기열 ${shuffledCount}곡을 섞었습니다`;
  await sendWebRemoteNotice(client, guildId, actorUserId, actionText);
}

// deprecated — sendWebRemoteQueueSwapNotice 사용
export async function sendTemporarySoundroomQueueSwapNotice(
  client: MineClient,
  guildId: string,
  actorUserId: string,
  fromQueueIndex: number,
  fromTitle: string,
  toQueueIndex: number,
  toTitle: string,
): Promise<void> {
  await sendWebRemoteQueueSwapNotice(
    client,
    guildId,
    actorUserId,
    fromQueueIndex,
    fromTitle,
    toQueueIndex,
    toTitle,
  );
}
