import {
  ActionRowBuilder,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type MessageActionRowComponentBuilder,
  type MessageEditOptions,
  type MessageMentionOptions,
  type MessageReplyOptions,
  type Snowflake,
} from "discord.js";
import type { ExtendedTrack } from "@/types";

export interface PanelOptions {
  eyebrow?: string;
  title: string;
  description?: string;
  lines?: string[];
  imageUrl?: string;
  subtle?: boolean;
  /** Components V2 컨테이너 왼쪽 액센트 색(RGB 정수). 미지정 시 기존과 동일. */
  accentColor?: number;
}

export interface PanelMessageOptions {
  panel: PanelOptions;
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral?: boolean;
  /** Reply 시 멘션 파싱 제어 (예: `{ parse: [] }`로 본문의 `<@id>` 알림 방지) */
  allowedMentions?: MessageMentionOptions;
}

export interface PanelEditOptions {
  panel: PanelOptions;
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export function formatTrackDuration(track: ExtendedTrack): string {
  return track.info.isStream
    ? "Live stream"
    : formatDuration(track.info.length);
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function progressBar(
  currentMs: number,
  totalMs: number,
  size = 18,
): string {
  if (totalMs <= 0) {
    return `[${"-".repeat(size)}]`;
  }

  const ratio = Math.max(0, Math.min(1, currentMs / totalMs));
  const headIndex = Math.min(size - 1, Math.max(0, Math.round(size * ratio)));

  return `[${Array.from({ length: size }, (_, index) => {
    if (index < headIndex) {
      return "=";
    }

    if (index === headIndex) {
      return ">";
    }

    return "-";
  }).join("")}]`;
}

export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

export function buildPanel(options: PanelOptions): ContainerBuilder {
  const container = new ContainerBuilder();
  if (options.accentColor !== undefined) {
    container.setAccentColor(options.accentColor);
  }
  const bodyLines = options.lines?.filter(Boolean) ?? [];
  const eyebrow = options.eyebrow ? `### ${options.eyebrow}\n` : "";
  const header = `${eyebrow}## ${options.title}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(header),
  );

  if (!options.subtle) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );
  }

  const mainText = [options.description, ...bodyLines]
    .filter(Boolean)
    .join("\n\n");

  if (options.imageUrl) {
    const section = new SectionBuilder();
    section.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(mainText || " "),
    );
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(options.imageUrl),
    );
    container.addSectionComponents(section);
  } else if (mainText) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(mainText),
    );
  }

  return container;
}

export function panelReply(
  options: PanelMessageOptions,
): InteractionReplyOptions {
  const reply: InteractionReplyOptions = {
    flags: options.ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2,
    components: [
      buildPanel(options.panel),
      ...(options.components ?? []),
    ] as any,
  };
  if (options.allowedMentions !== undefined) {
    reply.allowedMentions = options.allowedMentions;
  }
  return reply;
}

export function panelEdit(
  options: PanelEditOptions,
): InteractionUpdateOptions & MessageEditOptions {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      buildPanel(options.panel),
      ...(options.components ?? []),
    ] as any,
  };
}

export function panelMessage(
  options: PanelMessageOptions,
): MessageReplyOptions {
  const msg: MessageReplyOptions = {
    flags: options.ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2,
    components: [
      buildPanel(options.panel),
      ...(options.components ?? []),
    ] as any,
  };
  if (options.allowedMentions !== undefined) {
    msg.allowedMentions = options.allowedMentions;
  }
  return msg;
}

export function isSendableChannel(
  channel: unknown,
): channel is { send: (options: object) => Promise<unknown> } {
  return (
    typeof channel === "object" &&
    channel !== null &&
    "send" in channel &&
    typeof channel.send === "function"
  );
}

export function requesterName(track: ExtendedTrack): string {
  return track.info.requester?.user.username ?? "Unknown user";
}

export function voiceMention(channelId: Snowflake): string {
  return `<#${channelId}>`;
}
