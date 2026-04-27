import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { clearMelonChartSource, setMelonChartSource } from "@/storage/soundroomCharts";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "melon_chart",
  nameLocalizations: { ko: "인기차트-관리" },
  description: "Set the global YouTube playlist for [인기차트] on every server (bot developers only).",
  descriptionLocalizations: {
    ko: "모든 서버 노래 채널 [인기차트]에 쓸 유튜브 재생목록을 하나만 등록·해제합니다. (봇 제작자만)",
  },
  category: "utility",
  developerOnly: true,
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "set",
      nameLocalizations: { ko: "등록" },
      description: "Save one playlist URL for all servers.",
      descriptionLocalizations: { ko: "모든 서버에 적용할 재생목록 주소 저장" },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "url",
          description: "YouTube playlist or watch?v=…&list=…",
          descriptionLocalizations: { ko: "유튜브 재생목록 또는 watch?v=…&list=…" },
          required: true,
          maxLength: 600,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "clear",
      nameLocalizations: { ko: "해제" },
      description: "Remove the global playlist (every server).",
      descriptionLocalizations: { ko: "전역 등록 삭제 (모든 서버)" },
    },
  ],

  async run(_client, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "서버에서만 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const sub = interaction.options.getSubcommand(true);
    if (sub === "clear") {
      clearMelonChartSource();
      await interaction.reply({
        content: "전역 인기차트 재생목록 등록을 지웠습니다. 모든 서버에서 [인기차트]가 비어 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const raw = interaction.options.getString("url", true);
    const result = setMelonChartSource(raw);
    if (!result.ok) {
      await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const extra = result.parsed.priorityVideoId
      ? `\n지정한 영상이 목록에서 **맨 먼저** 재생됩니다.`
      : "";
    await interaction.reply({
      content: `전역으로 등록했습니다. **어느 서버** 노래 채널에서든 [인기차트]가 이 재생목록을 재생합니다.${extra}`,
      flags: MessageFlags.Ephemeral,
    });
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;
