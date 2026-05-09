import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  findStockSymbol,
  getSupportedStockSymbols,
} from "@/settings/stockSymbols";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import {
  formatAnsiQuoteLine,
  formatStockRefreshTime,
  wrapAnsiCodeBlock,
} from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "시세",
  description: "종목의 현재 모의투자 시세를 확인합니다.",
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

    const raw = interaction.options.getString("종목", true);
    const sym = findStockSymbol(raw);

    if (!sym) {
      const hint = getSupportedStockSymbols()
        .map((s) => `${s.nameKo} (${s.code})`)
        .join("\n");
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "📈 종목 시세",
            lines: [
              "알 수 없는 입력입니다. 아래 지원 종목 중에서 다시 입력해 주세요.",
              "",
              hint,
            ],
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const market = client.stockMarket;
    const p = market?.getCachedPrice(sym.symbol);

    if (!p) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "📈 종목 시세",
            description: "시세 준비 중입니다. 잠시 후 다시 시도해 주세요.",
            lines: [
              `**${sym.nameKo}** (${sym.code})`,
              "",
              "※ 모의투자 게임용이며 실제 투자용이 아닙니다.",
            ],
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "📈 종목 시세",
          lines: [
            `**${p.nameKo}** (${p.code})`,
            wrapAnsiCodeBlock(
              formatAnsiQuoteLine(p.price, p.changePercent),
            ),
            "",
            `🕐 마지막 갱신: ${formatStockRefreshTime(p.updatedAt)}`,
            `📡 시세 출처: ${p.provider}`,
            "",
            "※ 모의투자 게임용이며 실제 투자용이 아닙니다.",
          ],
        },
      }),
    );

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;
