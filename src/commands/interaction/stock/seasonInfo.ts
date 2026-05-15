import { MessageFlags } from "discord.js";
import {
  getActiveStockSeason,
  getLatestEndedStockSeason,
  listStockSeasonResults,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { formatCoin, formatStockRefreshTime } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "시즌정보",
  description: "현재 시즌과 최근 종료 시즌 정보를 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildId = interaction.guildId;
    const active = getActiveStockSeason(guildId);
    const latestEnded = getLatestEndedStockSeason(guildId);

    const lines: string[] = [];

    if (active) {
      lines.push(
        "**진행 중인 시즌**",
        `시즌명: \`${active.name}\``,
        `시작: ${formatStockRefreshTime(new Date(active.startedAt))}`,
        "",
      );
    } else {
      lines.push("진행 중인 시즌 없음", "");
    }

    if (latestEnded) {
      const results = listStockSeasonResults(latestEnded.id);
      const top3 = results.slice(0, 3);
      lines.push(
        "**최근 종료 시즌**",
        `시즌명: \`${latestEnded.name}\``,
        `종료: ${formatStockRefreshTime(
          latestEnded.endedAt ? new Date(latestEnded.endedAt) : null,
        )}`,
      );
      if (top3.length > 0) {
        lines.push("");
        for (const r of top3) {
          lines.push(
            `${r.rank}위 <@${r.userId}> ${formatCoin(r.totalAssets)}`,
          );
        }
      }
    } else {
      lines.push("저장된 종료 시즌 결과가 없습니다.");
    }

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🏁 시즌 정보",
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;
