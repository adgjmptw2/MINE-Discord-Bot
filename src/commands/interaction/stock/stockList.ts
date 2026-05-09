import { MessageFlags } from "discord.js";
import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import {
  formatAnsiQuoteLine,
  formatStockRefreshTime,
  wrapAnsiCodeBlock,
} from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "주식목록",
  description: "모의투자에서 지원하는 주식 목록을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const market = client.stockMarket;
    const symbols = getSupportedStockSymbols();

    const lines: string[] = [];

    // 종목 블록을 한 덩어리로 두고 사이는 \n만 둔다. buildPanel이 항목마다 \n\n을 넣어
    // 코드블록 아래 빈 줄이 겹쳐 두 줄처럼 보이는 것을 막는다.
    const stockSection = symbols
      .map((s, index) => {
        const i = index + 1;
        const p = market?.getCachedPrice(s.symbol);
        const inner = p
          ? formatAnsiQuoteLine(p.price, p.changePercent)
          : "시세 준비 중";
        return `📊 ${i}. ${s.nameKo}\n${wrapAnsiCodeBlock(inner)}`;
      })
      .join("\n");

    lines.push(stockSection);

    const lastAt = market?.getLastRefreshAt() ?? null;

    lines.push(`마지막 갱신: ${formatStockRefreshTime(lastAt)}`);
    lines.push("시세는 모의투자 게임용이며 실제 투자용이 아닙니다.");

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "📋 모의투자 종목",
          lines,
        },
      }),
    );
  },
};

export default command;
