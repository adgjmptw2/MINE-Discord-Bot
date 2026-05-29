import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  findStockSymbol,
  getSupportedStockSymbols,
} from "@/settings/stockSymbols";
import {
  MIN_STOCK_SELL_AMOUNT,
  sellStock,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { isStockTradingAllowed } from "@/utils/stockTradingHours";
import { parseSellInput } from "@/utils/parseSellInput";
import { formatCoin, formatStockQuantity } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

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
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const scheduleIfEphemeral = () => scheduleEphemeralReplyDelete(interaction);

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const rawSymbol = interaction.options.getString("종목", true);
    const symMeta = findStockSymbol(rawSymbol);

    if (!symMeta) {
      const symbols = getSupportedStockSymbols();
      const hintShown = symbols.slice(0, 5);
      const hintLines = hintShown.map((s) => `${s.nameKo} (${s.code})`);
      if (symbols.length > hintShown.length) {
        hintLines.push(`외 ${symbols.length - hintShown.length}종목`);
      }
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도",
            description: "지원하지 않는 종목입니다.",
            lines: hintLines,
          },
        }),
      );
      scheduleIfEphemeral();
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
            description:
              "매도 방식을 알 수 없습니다. 예: `5000`, `50%`, `전부`",
          },
        }),
      );
      scheduleIfEphemeral();
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
      scheduleIfEphemeral();
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
      scheduleIfEphemeral();
      return;
    }

    const price = cached.price;
    const stockCfg = client.config.stock;

    const trading = isStockTradingAllowed(stockCfg);
    if (!trading.allowed) {
      const range = `평일 ${trading.startLabel}~${trading.endLabel} KST`;
      const description =
        trading.reason === "WEEKEND"
          ? `주말에는 주식 거래를 할 수 없습니다.\n거래 가능 시간: ${range}`
          : `현재는 주식 거래 시간이 아닙니다.\n거래 가능 시간: ${range}`;
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매도",
            description,
          },
        }),
      );
      scheduleIfEphemeral();
      return;
    }

    try {
      const feeArgs = {
        sellFeeRate: stockCfg.stockSellFeeRate,
        sellTaxRate: stockCfg.stockSellTaxRate,
      };
      const r =
        parsed.mode === "all"
          ? sellStock({
              guildId,
              userId,
              symbol: symMeta.symbol,
              price,
              mode: "all",
              ...feeArgs,
            })
          : parsed.mode === "percent"
            ? sellStock({
                guildId,
                userId,
                symbol: symMeta.symbol,
                price,
                mode: "percent",
                percent: parsed.percent,
                ...feeArgs,
              })
            : sellStock({
                guildId,
                userId,
                symbol: symMeta.symbol,
                price,
                mode: "amount",
                amount: parsed.amount,
                ...feeArgs,
              });

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "📉 매도 완료",
            description: `${symMeta.nameKo} (${symMeta.code})  ·  ${formatStockQuantity(r.soldQuantityMicro)}  ·  ${formatCoin(r.netAmount)}`,
            lines: [
              `실현손익 ${formatCoin(r.realizedProfit)}  ·  현금 ${formatCoin(r.wallet.cashBalance)}`,
              `남은 보유 ${formatStockQuantity(r.remainingQuantityMicro)}  ·  수수료·세금 ${formatCoin(r.totalFee)}`,
              "_모의투자용 거래입니다._",
            ],
          },
        }),
      );
      return;
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
          description = `최소 매도 금액은 ${MIN_STOCK_SELL_AMOUNT.toLocaleString("ko-KR")} 코인입니다.`;
        } else if (e.code === "INVALID_PERCENT") {
          description = "퍼센트는 1~100 사이로 입력해주세요.";
        } else if (e.code === "QUANTITY_TOO_SMALL") {
          description =
            "매도 수량이 너무 작습니다. 금액이나 비율을 조정해 주세요.";
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
        scheduleIfEphemeral();
        return;
      } else {
        await interaction.reply({
          content:
            e instanceof Error
              ? e.message
              : "매도 처리 중 오류가 발생했습니다.",
          flags: MessageFlags.Ephemeral,
        });
        scheduleIfEphemeral();
        return;
      }
    }
  },
};

export default command;
