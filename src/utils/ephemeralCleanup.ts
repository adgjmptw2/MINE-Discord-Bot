import { InteractionWebhook, type Client } from "discord.js";

export const SOUNDROOM_TOAST_DELETE_MS = 12_000;

export function scheduleEphemeralFollowUpDelete(
  interaction: { webhook: InteractionWebhook },
  messageId: string,
  delayMs: number = SOUNDROOM_TOAST_DELETE_MS,
): void {
  const { webhook } = interaction;
  setTimeout(() => {
    void webhook.deleteMessage(messageId).catch(() => undefined);
  }, delayMs);
}

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
const queuePanelWebhookCtx = new Map<
  string,
  { client: Client<true>; applicationId: string; token: string }
>();

type InteractionWithWebhook = {
  client: Client<true>;
  webhook: InteractionWebhook;
};

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
