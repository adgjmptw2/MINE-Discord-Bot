import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { getSoundroom, setSoundroom, clearSoundroom } from "@/storage/soundroom";
import { buildSoundroomIdlePayload } from "@/utils/soundroomPanel";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { SlashCommand } from "@/types";

const COMMAND_NAME = "세팅";

const command: SlashCommand = {
  name: COMMAND_NAME,
  description: "Create a dedicated soundroom channel with a control panel.",
  descriptionLocalizations: { ko: "전용 음악 채널(노래 채널)과 패널 메시지를 만듭니다." },
  category: "utility",

  async run(client, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "서버에서만 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guild = interaction.guild!;
    const me = guild.members.me;
    if (!me?.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
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
      const ch = guild.channels.cache.get(existing.channelId) ?? (await guild.channels.fetch(existing.channelId).catch(() => null));
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

    const channelName = client.config.soundroom?.channelName?.trim() || "🎵 | 마인-노래채널";

    try {
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        reason: "Soundroom (/세팅)",
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
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

      const panel = await channel.send(buildSoundroomIdlePayload(client));

      setSoundroom(guild.id, channel.id, panel.id);

      await interaction.editReply({
        content: `노래 채널을 만들었습니다: ${channel}`,
      });
      scheduleEphemeralReplyDelete(interaction);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await interaction.editReply({
        content: `노래 채널을 만들지 못했습니다. 봇에게 **채널 관리** 등 필요한 권한이 있는지, 채널 이름에 쓸 수 없는 문자가 없는지 확인한 뒤 다시 시도해 주십시오.\n(${detail})`,
      });
      scheduleEphemeralReplyDelete(interaction);
    }
  },
};

export default command;
