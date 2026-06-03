import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import {
  enhanceCoinSword,
  StockStorageError,
  type EnhanceCoinSwordResult,
  type SwordEnhanceOutcome,
} from "@/storage/stock";
import {
  formatEnhanceArrowCode,
  formatEnhanceKeepCode,
  formatSwordName,
  formatSwordNameBoldNoPlus,
  formatSwordNameBoldWithPlus,
  formatSwordProgress,
  getEnhanceDestroyFlavor,
  getEnhanceDowngradeFlavor,
  getEnhanceFailFlavor,
  getEnhanceSuccessFlavor,
  SWORD_VIRTUAL_GAME_FOOTER,
} from "@/utils/swordDisplay";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const ENHANCE_REPLY_DELETE_MS = 5_000;

function outcomeTitle(outcome: SwordEnhanceOutcome): string {
  switch (outcome) {
    case "SUCCESS":
      return "✨ 강화 성공";
    case "FAIL_KEEP":
      return "🗡️ 강화 실패";
    case "FAIL_DOWNGRADE":
      return "📉 강화 하락";
    case "DESTROYED":
      return "💥 검 파괴";
    case "FAIL_DOWNGRADE_PROTECTED":
      return "🛡️ 하락 방지";
    case "DESTROYED_PROTECTED":
      return "🛡️ 파괴 방지";
    default:
      return "🗡️ 강화 실패";
  }
}

function unusedProtectionLine(r: EnhanceCoinSwordResult): string | null {
  if (
    (r.selectedDowngradeProtection && !r.usedDowngradeProtection) ||
    (r.selectedDestroyProtection && !r.usedDestroyProtection)
  ) {
    return "선택한 방지권은 이번에 소비되지 않았습니다.";
  }
  return null;
}

function buildPanelFromResult(r: EnhanceCoinSwordResult): {
  title: string;
  lines: string[];
} {
  const title = outcomeTitle(r.outcome);
  const cost = r.cost.toLocaleString("ko-KR");
  const bal = r.wallet.cashBalance.toLocaleString("ko-KR");
  const coinLine = `사용 \`${cost}코인\`  ·  잔고 \`${bal}코인\``;

  switch (r.outcome) {
    case "SUCCESS": {
      const lines: string[] = [
        formatSwordNameBoldWithPlus(r.afterLevel),
        formatSwordProgress(r.afterLevel),
        formatEnhanceArrowCode(r.beforeLevel, r.afterLevel),
        getEnhanceSuccessFlavor(r.afterLevel),
        "",
        coinLine,
        `성공률 **${r.successPercent}%**  ·  최고 **+${r.highestLevel}**`,
      ];
      const u = unusedProtectionLine(r);
      if (u) {
        lines.push("", u);
      }
      return { title, lines };
    }
    case "FAIL_KEEP": {
      const lines: string[] = [
        formatSwordNameBoldWithPlus(r.beforeLevel),
        formatSwordProgress(r.beforeLevel),
        formatEnhanceKeepCode(r.beforeLevel),
        getEnhanceFailFlavor(r.beforeLevel),
        "",
        coinLine,
        `성공률 **${r.successPercent}%**`,
      ];
      const u = unusedProtectionLine(r);
      if (u) {
        lines.push("", u);
      }
      return { title, lines };
    }
    case "FAIL_DOWNGRADE": {
      return {
        title,
        lines: [
          formatSwordNameBoldNoPlus(r.beforeLevel),
          formatSwordProgress(r.afterLevel),
          formatEnhanceArrowCode(r.beforeLevel, r.afterLevel),
          getEnhanceDowngradeFlavor(r.beforeLevel),
          "",
          coinLine,
          `성공률 **${r.successPercent}%**  ·  하락률 **${r.downgradePercent}%**`,
          "",
          ...SWORD_VIRTUAL_GAME_FOOTER,
        ],
      };
    }
    case "DESTROYED": {
      return {
        title,
        lines: [
          formatSwordNameBoldNoPlus(r.beforeLevel),
          formatEnhanceArrowCode(r.beforeLevel, r.afterLevel),
          getEnhanceDestroyFlavor(r.beforeLevel),
          "",
          coinLine,
          `파괴율 **${r.destroyPercent}%**`,
          "",
          ...SWORD_VIRTUAL_GAME_FOOTER,
        ],
      };
    }
    case "FAIL_DOWNGRADE_PROTECTED": {
      return {
        title,
        lines: [
          formatSwordNameBoldWithPlus(r.beforeLevel),
          formatSwordProgress(r.beforeLevel),
          formatEnhanceKeepCode(r.beforeLevel),
          "🛡️ 하락 방지권이 발동해 단계를 지켰습니다.",
          "",
          coinLine,
          "하락 방지권 **1개 소비**",
          "",
          ...SWORD_VIRTUAL_GAME_FOOTER,
        ],
      };
    }
    case "DESTROYED_PROTECTED": {
      return {
        title,
        lines: [
          formatSwordNameBoldWithPlus(r.beforeLevel),
          formatSwordProgress(r.beforeLevel),
          formatEnhanceKeepCode(r.beforeLevel),
          "🛡️ 파괴 방지권이 발동해 검을 지켰습니다.",
          "",
          coinLine,
          "파괴 방지권 **1개 소비**",
          "",
          ...SWORD_VIRTUAL_GAME_FOOTER,
        ],
      };
    }
    default: {
      return {
        title,
        lines: [
          formatSwordNameBoldWithPlus(r.beforeLevel),
          formatEnhanceKeepCode(r.beforeLevel),
          coinLine,
          "",
          ...SWORD_VIRTUAL_GAME_FOOTER,
        ],
      };
    }
  }
}

const command: SlashCommand = {
  name: "강화",
  description:
    "코인을 사용해 검 강화를 시도합니다. 방지권 옵션을 사용할 수 있습니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.Boolean,
      name: "하락방지",
      description:
        "하락 방지권을 사용합니다. 하락 결과가 나올 때만 1개 소비됩니다.",
      required: false,
    },
    {
      type: ApplicationCommandOptionType.Boolean,
      name: "파괴방지",
      description:
        "파괴 방지권을 사용합니다. 파괴 결과가 나올 때만 1개 소비됩니다.",
      required: false,
    },
  ],

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const useDowngradeProtection =
      interaction.options.getBoolean("하락방지") ?? false;
    const useDestroyProtection =
      interaction.options.getBoolean("파괴방지") ?? false;

    try {
      const r = enhanceCoinSword(guildId, userId, {
        useDowngradeProtection,
        useDestroyProtection,
      });
      const { title, lines } = buildPanelFromResult(r);
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: { title, lines },
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "WALLET_NOT_FOUND") {
          await interaction.reply({
            content: "`/출석`으로 코인을 받고 시작해 주세요.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
          return;
        }
        if (e.code === "INSUFFICIENT_CASH") {
          await interaction.reply({
            content: "강화에 필요한 코인이 부족합니다.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
          return;
        }
        if (e.code === "SWORD_MAX_LEVEL") {
          await interaction.reply(
            panelReply({
              ephemeral: false,
              panel: {
                title: "👑 최대 강화",
                description: formatSwordName(20),
                lines: [
                  "이미 **+20** 최대 강화입니다.",
                  "",
                  ...SWORD_VIRTUAL_GAME_FOOTER,
                ],
              },
              allowedMentions: NO_MENTION,
            }),
          );
          scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
          return;
        }
        if (e.code === "INVALID_SWORD_LEVEL") {
          await interaction.reply({
            content: "강화 중 오류가 발생했습니다.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
          return;
        }
        if (e.code === "INSUFFICIENT_ITEM_QUANTITY") {
          await interaction.reply({
            content: "방지권이 없습니다. `/상점`에서 구매하세요.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
          return;
        }
      }
      await interaction.reply({
        content: "강화 중 오류가 발생했습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction, ENHANCE_REPLY_DELETE_MS);
      return;
    }
  },
};

export default command;
