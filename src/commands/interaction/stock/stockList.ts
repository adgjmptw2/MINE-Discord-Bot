import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import { panelReply } from "@/utils/discord";
import {
  formatAnsiQuoteLine,
  formatStockRefreshTime,
  wrapAnsiCodeBlock,
} from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "주식목록",
  description: "모의투자에서 지원하는 주식 목록을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        allowedMentions: NO_MENTION,
      });
      return;
    }

    const market = client.stockMarket;
    const symbols = getSupportedStockSymbols();

    // 종목마다 제목 1줄 + (시세 있음) ANSI 블록 1개 | (없음) "시세 준비 중" 텍스트만
    const stockSection = symbols
      .map((s, index) => {
        const i = index + 1;
        const p = market?.getCachedPrice(s.symbol);
        const header = `📊 ${i}. ${s.nameKo}`;
        if (!p) {
          return `${header}\n\n시세 준비 중`;
        }
        return `${header}\n${wrapAnsiCodeBlock(
          formatAnsiQuoteLine(p.price, p.changePercent),
        )}`;
      })
      .join("\n");

    const lines: string[] = [
      stockSection,
      `마지막 갱신: ${formatStockRefreshTime(market?.getLastRefreshAt() ?? null)}`,
      "시세는 모의투자 게임용이며 실제 투자용이 아닙니다.",
    ];

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "📋 모의투자 종목",
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;
