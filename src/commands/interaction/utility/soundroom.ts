import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import {
  getSoundroom,
  setSoundroom,
  clearSoundroom,
} from "@/storage/soundroom";
import { buildSoundroomIdlePayload } from "@/utils/soundroomPanel";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { SlashCommand } from "@/types";

const COMMAND_NAME = "세팅";

function sanitizeGuildTextChannelName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, "-").slice(0, 100);
  const noEdgeHyphen = trimmed.replace(/^-+|-+$/g, "");
  return noEdgeHyphen.length > 0 ? noEdgeHyphen : "mine-soundroom";
}

const command: SlashCommand = {
  name: COMMAND_NAME,
  description: "Create a dedicated soundroom channel with a control panel.",
  descriptionLocalizations: {
    ko: "전용 음악 채널(노래 채널)과 패널 메시지를 만듭니다.",
  },
  category: "utility",

  async run(client, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guild = interaction.guild!;
    const me =
      guild.members.me ??
      (await guild.members
        .fetch({ user: client.user!.id, force: true })
        .catch(() => null));
    if (
      !me?.permissions.has([
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ])
    ) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content:
          "채널 생성·채팅 정리·임베드를 위해 **채널 관리**, **메시지 관리**, **메시지 전송**, **링크 임베드** 권한이 필요합니다. (패널을 상단에 두려면 채널에서 직접 **메시지 고정**을 쓰면 됩니다.)",
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const existing = getSoundroom(guild.id);
    if (existing) {
      const ch =
        guild.channels.cache.get(existing.channelId) ??
        (await guild.channels.fetch(existing.channelId).catch(() => null));
      if (ch?.isTextBased()) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `이미 노래 채널이 있습니다: ${ch}`,
        });
        scheduleEphemeralReplyDelete(interaction);
        return;
      }

      clearSoundroom(guild.id);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelName = sanitizeGuildTextChannelName(
      client.config.soundroom?.channelName?.trim() || "🎵-마인-노래채널",
    );

    try {
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        reason: "Soundroom (/세팅)",
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: client.user!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      const panel = await channel.send(
        buildSoundroomIdlePayload(client, guild.id),
      );

      setSoundroom(guild.id, channel.id, panel.id);

      await interaction.editReply({
        content: `노래 채널을 만들었습니다: ${channel}`,
      });
      scheduleEphemeralReplyDelete(interaction);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await interaction.editReply({
        content: `노래 채널을 만들지 못했습니다.\n• **서버 관리자**가 아니라 **봇 역할**에 채널 관리·메시지 관리·전송·임베드가 있는지 확인하세요.\n• 채널 이름(\`${channelName}\`)에 Discord가 막는 문자가 있으면 \`config.soundroom.channelName\`을 바꿔 주세요.\n(${detail})`,
      });
      scheduleEphemeralReplyDelete(interaction, 120_000);
    }
  },
};

export default command;
