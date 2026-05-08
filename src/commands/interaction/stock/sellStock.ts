import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { findStockSymbol, getSupportedStockSymbols } from "@/settings/stockSymbols";
import {
  MIN_STOCK_SELL_AMOUNT,
  sellStock,
  StockStorageError,
  STOCK_QUANTITY_SCALE,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { parseSellInput } from "@/utils/parseSellInput";
import { formatMine } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

// TODO: 정규장 거래 시간 제한은 추후 설정값으로 추가 가능

function formatShares(quantityMicro: number): string {
  const shares = quantityMicro / STOCK_QUANTITY_SCALE;
  return shares.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
}

const command: SlashCommand = {
  name: "매도",
  description: "보유 주식을 매도합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "종목",
      description: "종목명 또는 종목코드",
      required: true,
      maxLength: 64,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "매도",
      description: "예: 5000, 50%, 전부",
      required: true,
      maxLength: 32,
    },
  ],

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "서버에서만 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const rawSymbol = interaction.options.getString("종목", true);
    const symMeta = findStockSymbol(rawSymbol);

    if (!symMeta) {
      const hint = getSupportedStockSymbols()
        .map((s) => `${s.nameKo} (${s.code})`)
        .join("\n");
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도",
            lines: ["지원하지 않는 종목입니다. 아래에서 다시 선택해 주세요.", "", hint],
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const rawSell = interaction.options.getString("매도", true);
    const parsed = parseSellInput(rawSell);

    if (!parsed) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도",
            description: "매도 방식을 알 수 없습니다. 예: `5000`, `50%`, `전부`",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const market = client.stockMarket;
    if (!market || !market.isReady()) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도",
            description: "시세 캐시가 아직 준비되지 않았습니다.",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const cached = market.getCachedPrice(symMeta.symbol);
    if (!cached) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도",
            description: "해당 종목 시세가 아직 준비되지 않았습니다.",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const price = cached.price;

    try {
      const r =
        parsed.mode === "all"
          ? sellStock({
              guildId,
              userId,
              symbol: symMeta.symbol,
              price,
              mode: "all",
            })
          : parsed.mode === "percent"
            ? sellStock({
                guildId,
                userId,
                symbol: symMeta.symbol,
                price,
                mode: "percent",
                percent: parsed.percent,
              })
            : sellStock({
                guildId,
                userId,
                symbol: symMeta.symbol,
                price,
                mode: "amount",
                amount: parsed.amount,
              });

      const lines = [
        `**${symMeta.nameKo}** (${symMeta.code})`,
        `체결가: ${formatMine(r.price)}`,
        `매도 수량: ${formatShares(r.soldQuantityMicro)}주`,
        `매도금액: ${formatMine(r.grossAmount)}`,
        `수수료: ${formatMine(r.fee)}`,
        `실제 입금: ${formatMine(r.netAmount)}`,
        `실현손익: ${formatMine(r.realizedProfit)}`,
        `남은 보유: ${formatShares(r.remainingQuantityMicro)}주`,
        `남은 현금: ${formatMine(r.wallet.cashBalance)}`,
        "",
        "※ 모의투자 게임용 거래입니다. 실제 투자와 무관합니다.",
      ];

      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도 체결",
            lines,
          },
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        let description = "처리할 수 없습니다.";
        if (e.code === "WALLET_NOT_FOUND") {
          description = "/출석으로 먼저 가상 화폐를 받아주세요.";
        } else if (e.code === "HOLDING_NOT_FOUND") {
          description = "해당 종목을 보유하고 있지 않습니다.";
        } else if (e.code === "INSUFFICIENT_HOLDING") {
          description = "보유 수량이 부족합니다.";
        } else if (e.code === "INVALID_AMOUNT") {
          description = `최소 매도 금액은 ${MIN_STOCK_SELL_AMOUNT.toLocaleString("ko-KR")} MINE입니다.`;
        } else if (e.code === "INVALID_PERCENT") {
          description = "퍼센트는 1~100 사이로 입력해주세요.";
        } else if (e.code === "QUANTITY_TOO_SMALL") {
          description = "매도 수량이 너무 작습니다. 금액이나 비율을 조정해 주세요.";
        } else if (e.code === "INVALID_PRICE") {
          description = "시세 준비 중입니다.";
        }

        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              title: "매도",
              description,
            },
          }),
        );
      } else {
        await interaction.reply({
          content: e instanceof Error ? e.message : "매도 처리 중 오류가 발생했습니다.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;
