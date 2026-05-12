import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import {
  getOrCreateCoinGuildSettings,
  StockStorageError,
  updateCoinGuildSettings,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { formatCoin } from "@/utils/stockFormat";
import { canUseStockAdminCommand } from "@/utils/permissions";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const ITEM_QUERY = "조회";
const ITEM_ATTENDANCE = "출석보상";
const ITEM_RPS_MIN = "가위바위보최소베팅";
const ITEM_RPS_MAX = "가위바위보최대베팅";
const ITEM_RPS_COOLDOWN = "가위바위보쿨다운";

function formatSettingsLines(s: ReturnType<typeof getOrCreateCoinGuildSettings>) {
  return [
    `출석 보상: **${formatCoin(s.attendanceReward)}**`,
    `가위바위보 최소 베팅: **${formatCoin(s.rpsMinBet)}**`,
    `가위바위보 최대 베팅: **${formatCoin(s.rpsMaxBet)}**`,
    `가위바위보 쿨다운: **${s.rpsCooldownSeconds}초**`,
  ];
}

const command: SlashCommand = {
  name: "코인설정",
  description: "서버 코인 경제 설정을 확인하거나 변경합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "항목",
      description: "조회 또는 변경할 항목",
      required: false,
      choices: [
        { name: "조회", value: ITEM_QUERY },
        { name: "출석보상", value: ITEM_ATTENDANCE },
        { name: "가위바위보최소베팅", value: ITEM_RPS_MIN },
        { name: "가위바위보최대베팅", value: ITEM_RPS_MAX },
        { name: "가위바위보쿨다운", value: ITEM_RPS_COOLDOWN },
      ],
    },
    {
      type: ApplicationCommandOptionType.Integer,
      name: "값",
      description: "변경할 값 (조회 시 생략)",
      required: false,
      minValue: 0,
      maxValue: 1_000_000,
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

    const guildId = interaction.guildId;
    const item = interaction.options.getString("항목");
    const intValue = interaction.options.getInteger("값");

    const isQuery = !item || item === ITEM_QUERY;

    if (isQuery) {
      const s = getOrCreateCoinGuildSettings(guildId);
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "⚙️ 서버 코인 설정",
            lines: formatSettingsLines(s),
          },
          allowedMentions: NO_MENTION,
        }),
      );
      return;
    }

    if (!canUseStockAdminCommand(client, interaction)) {
      await interaction.reply({
        content: "코인 설정을 변경하려면 서버 관리자 또는 봇 운영자 권한이 필요합니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (intValue === null) {
      await interaction.reply({
        content: "설정을 변경하려면 `값` 옵션에 숫자를 입력해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      let patch: Parameters<typeof updateCoinGuildSettings>[1];
      let label = "";

      if (item === ITEM_ATTENDANCE) {
        patch = { attendanceReward: intValue };
        label = "출석 보상";
      } else if (item === ITEM_RPS_MIN) {
        patch = { rpsMinBet: intValue };
        label = "가위바위보 최소 베팅";
      } else if (item === ITEM_RPS_MAX) {
        patch = { rpsMaxBet: intValue };
        label = "가위바위보 최대 베팅";
      } else if (item === ITEM_RPS_COOLDOWN) {
        patch = { rpsCooldownSeconds: intValue };
        label = "가위바위보 쿨다운";
      } else {
        await interaction.reply({
          content: "알 수 없는 항목입니다.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const updated = updateCoinGuildSettings(guildId, patch);

      const valueStr =
        item === ITEM_RPS_COOLDOWN
          ? `${updated.rpsCooldownSeconds}초`
          : formatCoin(
              item === ITEM_ATTENDANCE
                ? updated.attendanceReward
                : item === ITEM_RPS_MIN
                  ? updated.rpsMinBet
                  : updated.rpsMaxBet,
            );

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "⚙️ 코인 설정 변경 완료",
            description: `${label}: **${valueStr}** (저장 완료)`,
            lines: formatSettingsLines(updated),
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (
        e instanceof StockStorageError &&
        e.code === "INVALID_COIN_GUILD_SETTINGS"
      ) {
        await interaction.reply({
          content:
            "값이 허용 범위를 벗어났거나, 최소 베팅이 최대 베팅보다 큽니다. 출석 보상 0~1,000,000 코인, 베팅 한도 각 1~1,000,000 코인(최소≤최대), 쿨다운 0~60초를 확인해 주세요.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      throw e;
    }
  },
};

export default command;
