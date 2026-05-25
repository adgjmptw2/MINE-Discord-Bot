import { getSoundroom } from "@/storage/soundroom";
import type { MineClient } from "@/types";

const NOTICE_DELETE_MS = 30_000;
const TITLE_MAX_LEN = 60;

const MENTION_NONE = { parse: [] as const };

function truncateTitle(title: string): string {
  const t = title.trim() || "제목 없음";
  if (t.length <= TITLE_MAX_LEN) {
    return t;
  }
  return `${t.slice(0, TITLE_MAX_LEN - 1)}…`;
}

/** 대기열 순서 변경 성공 안내 — 실패·삭제 실패는 무시한다. */
export async function sendTemporarySoundroomQueueSwapNotice(
  client: MineClient,
  guildId: string,
  actorUserId: string,
  fromQueueIndex: number,
  fromTitle: string,
  toQueueIndex: number,
  toTitle: string,
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

    const fromLabel = `${fromQueueIndex + 1}. ${truncateTitle(fromTitle)}`;
    const toLabel = `${toQueueIndex + 1}. ${truncateTitle(toTitle)}`;
    const content = `<@${actorUserId}>님이 대기열에서 **${fromLabel}** ↔ **${toLabel}** 순서를 변경하였습니다.`;

    const message = await channel.send({
      content,
      allowedMentions: MENTION_NONE,
    });

    setTimeout(() => {
      void message.delete().catch(() => undefined);
    }, NOTICE_DELETE_MS);
  } catch {
    /* 전송·삭제 실패는 swap API 성공과 분리 */
  }
}
