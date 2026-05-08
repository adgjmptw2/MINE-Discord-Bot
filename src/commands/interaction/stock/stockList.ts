import { MessageFlags } from "discord.js";
import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { formatMine, formatPercent, formatStockRefreshTime } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "주식목록",
  description: "모의투자에서 지원하는 주식 목록을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "서버에서만 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const market = client.stockMarket;
    const cacheReady = market?.isReady() ?? false;
    const symbols = getSupportedStockSymbols();

    const lines: string[] = [];
    if (!market || !cacheReady) {
      lines.push("_시세 캐시 준비 중입니다._", "");
    }

    for (const s of symbols) {
      const p = market?.getCachedPrice(s.symbol);
      if (p) {
        lines.push(`${s.nameKo} (${s.code}) — ${formatMine(p.price)} / ${formatPercent(p.changePercent)}`);
      } else {
        lines.push(`${s.nameKo} (${s.code}) — 시세 준비 중`);
      }
    }

    const provider = client.config.stock.stockPriceProvider;
    const lastAt = market?.getLastRefreshAt() ?? null;
    const lastErr = market?.getLastError();

    lines.push("", `마지막 갱신: ${formatStockRefreshTime(lastAt)}`);
    lines.push(`시세 출처: ${provider}${lastErr ? ` · 마지막 오류: ${lastErr}` : ""}`);

    lines.push("", "※ 모의투자 게임용 시세이며 실제 투자용이 아닙니다.");

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "주식목록",
          lines,
        },
      }),
    );

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;
