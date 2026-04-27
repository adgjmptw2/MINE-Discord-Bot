/**
 * Ephemeral “토스트” 답변을 일정 시간 뒤 자동 삭제합니다.
 */

import { InteractionWebhook, type Client } from "discord.js";

export const SOUNDROOM_TOAST_DELETE_MS = 12_000;
/** 노래 채널 대기열 패널(ephemeral) 자동 삭제까지 대기 시간 */
export const SOUNDROOM_QUEUE_PANEL_DELETE_MS = 60_000;

export function scheduleEphemeralReplyDelete(
  interaction: { deleteReply(): Promise<unknown> },
  delayMs: number = SOUNDROOM_TOAST_DELETE_MS,
): void {
  setTimeout(() => {
    void interaction.deleteReply().catch(() => undefined);
  }, delayMs);
}

const queuePanelDeleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** interaction 응답으로 만든 ephemeral는 interaction token으로만 삭제 가능 */
const queuePanelWebhookCtx = new Map<
  string,
  { client: Client<true>; applicationId: string; token: string }
>();

type InteractionWithWebhook = {
  client: Client<true>;
  webhook: InteractionWebhook;
};

/**
 * 대기열 패널(ephemeral)을 일정 시간 뒤 삭제합니다.
 * Discord는 interaction으로 보낸 ephemeral를 `message.delete()`가 아니라 **interaction webhook**으로만 지웁니다.
 *
 * @param interaction 마지막으로 이 패널을 `reply`/`update`한 인터랙션(토큰 갱신). 모달 직후 `edit`만 한 경우엔 `null`로 두면 이전에 저장된 토큰을 유지합니다.
 * @param message 삭제할 메시지 id만 사용합니다.
 */
export function scheduleQueuePanelEphemeralDelete(
  interaction: InteractionWithWebhook | null | undefined,
  message: Pick<{ id: string }, "id">,
  delayMs: number = SOUNDROOM_QUEUE_PANEL_DELETE_MS,
): void {
  const messageId = message.id;
  const token = interaction?.webhook?.token;
  if (interaction && token) {
    queuePanelWebhookCtx.set(messageId, {
      client: interaction.client,
      applicationId: interaction.webhook.id,
      token,
    });
  }

  const prev = queuePanelDeleteTimers.get(messageId);
  if (prev !== undefined) {
    clearTimeout(prev);
  }
  const t = setTimeout(() => {
    queuePanelDeleteTimers.delete(messageId);
    const ctx = queuePanelWebhookCtx.get(messageId);
    queuePanelWebhookCtx.delete(messageId);
    if (!ctx?.token) {
      return;
    }
    const wh = new InteractionWebhook(ctx.client, ctx.applicationId, ctx.token);
    void wh.deleteMessage(messageId).catch(() => undefined);
  }, delayMs);
  queuePanelDeleteTimers.set(messageId, t);
}
