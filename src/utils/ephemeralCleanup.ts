import { InteractionWebhook, type Message } from "discord.js";
import { WEB_REMOTE_NOTICE_DELETE_MS } from "@/web/soundroomChannelNotice";

export const SOUNDROOM_TOAST_DELETE_MS = WEB_REMOTE_NOTICE_DELETE_MS;

export function scheduleEphemeralFollowUpDelete(
  interaction: { webhook: InteractionWebhook },
  messageOrId: Message | string,
  delayMs: number = SOUNDROOM_TOAST_DELETE_MS,
): void {
  const messageId =
    typeof messageOrId === "string" ? messageOrId : messageOrId.id;
  const message = typeof messageOrId === "string" ? null : messageOrId;

  setTimeout(() => {
    if (message?.deletable) {
      void message.delete().catch(() => {
        void interaction.webhook.deleteMessage(messageId).catch(() => undefined);
      });
      return;
    }
    void interaction.webhook.deleteMessage(messageId).catch(() => undefined);
  }, delayMs);
}

export const SOUNDROOM_QUEUE_PANEL_DELETE_MS = 60_000;

export function scheduleEphemeralReplyDelete(
  interaction: {
    deleteReply(): Promise<unknown>;
    message?: Message | null;
  },
  delayMs: number = SOUNDROOM_TOAST_DELETE_MS,
): void {
  setTimeout(() => {
    void interaction.deleteReply().catch(() => {
      const msg = interaction.message;
      if (msg?.deletable) {
        void msg.delete().catch(() => undefined);
      }
    });
  }, delayMs);
}

const queuePanelDeleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const queuePanelWebhookCtx = new Map<
  string,
  { client: import("discord.js").Client<true>; applicationId: string; token: string }
>();

type InteractionWithWebhook = {
  client: import("discord.js").Client<true>;
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
