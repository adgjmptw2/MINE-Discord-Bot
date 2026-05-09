import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  findStockSymbol,
  getSupportedStockSymbols,
} from "@/settings/stockSymbols";
import {
  buyStock,
  MIN_STOCK_BUY_AMOUNT,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { formatCoin, formatStockQuantity } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

// TODO: 정규장 거래 시간 제한은 추후 설정값으로 추가 가능

const command: SlashCommand = {
  name: "매수",
  description: "가상 화폐로 주식을 매수합니다.",
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
      type: ApplicationCommandOptionType.Integer,
      name: "금액",
      description: "매수할 금액(코인)",
      required: true,
      min_value: MIN_STOCK_BUY_AMOUNT,
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
            title: "매수",
            lines: [
              "지원하지 않는 종목입니다. 아래에서 다시 선택해 주세요.",
              "",
              hint,
            ],
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const amount = interaction.options.getInteger("금액", true);

    const market = client.stockMarket;
    if (!market || !market.isReady()) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "매수",
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
            title: "매수",
            description: "해당 종목 시세가 아직 준비되지 않았습니다.",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const price = cached.price;

    try {
      const r = buyStock({
        guildId,
        userId,
        symbol: symMeta.symbol,
        price,
        amount,
      });

      const lines = [
        `📌 **${symMeta.nameKo}** (${symMeta.code})`,
        `💵 체결가: ${formatCoin(r.price)}`,
        `🛒 매수금액: ${formatCoin(r.amount)}`,
        `📎 수수료: ${formatCoin(r.fee)}`,
        `💸 실제 차감: ${formatCoin(r.netAmount)}`,
        `📊 이번 매수 수량: ${formatStockQuantity(r.quantityMicro)}`,
        `📈 총 보유 수량: ${formatStockQuantity(r.totalQuantityMicro)}`,
        `📉 평균 매수가: ${formatCoin(r.averageBuyPrice)}`,
        `💰 남은 현금: ${formatCoin(r.wallet.cashBalance)}`,
        "",
        "※ 모의투자 게임용 거래입니다. 실제 투자와 무관합니다.",
      ];

      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "✅ 매수 체결",
            lines,
          },
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        let description = "처리할 수 없습니다.";
        if (e.code === "WALLET_NOT_FOUND") {
          description = "/출석으로 먼저 가상 화폐를 받아주세요.";
        } else if (e.code === "INSUFFICIENT_CASH") {
          description = "현금이 부족합니다.";
        } else if (e.code === "INVALID_AMOUNT") {
          description = `최소 매수 금액은 ${MIN_STOCK_BUY_AMOUNT.toLocaleString("ko-KR")} 코인입니다.`;
        } else if (e.code === "QUANTITY_TOO_SMALL") {
          description =
            "매수 금액이 너무 작아 주식을 살 수 없습니다. 금액을 늘려 주세요.";
        } else if (e.code === "INVALID_PRICE") {
          description = "시세 준비 중입니다.";
        }

        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              title: "매수",
              description,
            },
          }),
        );
      } else {
        await interaction.reply({
          content:
            e instanceof Error
              ? e.message
              : "매수 처리 중 오류가 발생했습니다.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;
