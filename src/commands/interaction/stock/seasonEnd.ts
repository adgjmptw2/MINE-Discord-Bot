import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  endActiveStockSeasonWithResults,
  getStockRanking,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { canUseStockAdminCommand } from "@/utils/permissions";
import { formatCoin } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const RANKING_SAVE_LIMIT = 10;
const NO_MENTION = { parse: [] as const };
const CONFIRM_PHRASE = "시즌종료";

const command: SlashCommand = {
  name: "시즌종료",
  description: "관리자가 현재 시즌을 종료하고 랭킹 결과를 저장합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "확인",
      description: `실행하려면 정확히 "${CONFIRM_PHRASE}"라고 입력하세요`,
      required: true,
      minLength: 4,
      maxLength: 16,
    },
  ],

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!canUseStockAdminCommand(client, interaction)) {
      await interaction.reply({
        content: "이 명령어는 서버 관리자만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confirm = interaction.options.getString("확인", true).trim();
    if (confirm !== CONFIRM_PHRASE) {
      await interaction.reply({
        content: "확인 문구가 일치하지 않습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildId = interaction.guildId;
    const market = client.stockMarket;
    if (!market || !market.isReady()) {
      await interaction.reply({
        content: "시세 캐시가 준비되지 않아 시즌을 종료할 수 없습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const cachedPrices = market.getCachedPrices();
    const ranking = getStockRanking(guildId, cachedPrices, RANKING_SAVE_LIMIT);

    try {
      const { season, savedResults } = endActiveStockSeasonWithResults(
        guildId,
        ranking,
      );

      const topLines = savedResults.slice(0, 3).map((row) => {
        return `${row.rank}위 <@${row.userId}> ${formatCoin(row.totalAssets)}`;
      });

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🏁 시즌 종료",
            lines: [
              `시즌명: \`${season.name}\``,
              "",
              ...topLines,
              "",
              "시즌 결과가 저장되었습니다.",
              "초기화가 필요하면 `/서버초기화`를 사용하세요.",
            ],
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "ACTIVE_SEASON_NOT_FOUND") {
          await interaction.reply({
            content: "종료할 진행 중인 시즌이 없습니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "EMPTY_RANKING") {
          await interaction.reply({
            content:
              "랭킹에 표시할 데이터가 없어 시즌을 종료할 수 없습니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      throw e;
    }
  },
};

export default command;
