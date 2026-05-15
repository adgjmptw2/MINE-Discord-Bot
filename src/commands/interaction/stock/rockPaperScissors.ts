import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import {
  DAILY_MISSION_KEY_RPS,
  getOrCreateCoinGuildSettings,
  parseRpsChoice,
  playRockPaperScissors,
  recordDailyMissionProgress,
  StockStorageError,
} from "@/storage/stock";
import { getKstDateString } from "@/utils/date";
import { panelReply } from "@/utils/discord";
import { formatCoin, formatSignedCoin } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const lastRpsAttemptByGuildUser = new Map<string, number>();

const command: SlashCommand = {
  name: "가위바위보",
  description: "코인을 걸고 봇과 가위바위보를 합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "선택",
      description: "낼 손",
      required: true,
      choices: [
        { name: "가위", value: "가위" },
        { name: "바위", value: "바위" },
        { name: "보", value: "보" },
      ],
    },
    {
      type: ApplicationCommandOptionType.Integer,
      name: "베팅",
      description: "베팅 코인 (서버 `/코인설정` 범위 내 정수)",
      required: true,
      minValue: 1,
      maxValue: 1_000_000,
    },
  ],

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rawChoice = interaction.options.getString("선택", true);
    const choice = parseRpsChoice(rawChoice);
    if (!choice) {
      await interaction.reply({
        content: "가위, 바위, 보 중에서 선택해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const bet = interaction.options.getInteger("베팅", true);
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const settings = getOrCreateCoinGuildSettings(guildId);
    const minBet = settings.rpsMinBet;
    const maxBet = settings.rpsMaxBet;

    if (
      !Number.isInteger(bet) ||
      bet < minBet ||
      bet > maxBet
    ) {
      await interaction.reply({
        content: `베팅은 ${minBet.toLocaleString("ko-KR")}~${maxBet.toLocaleString("ko-KR")} 코인 사이 정수여야 합니다. (/코인설정으로 범위 변경 가능)`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const cooldownSec = settings.rpsCooldownSeconds;
    if (cooldownSec > 0) {
      const cooldownKey = `${guildId}:${userId}`;
      const now = Date.now();
      const cooldownMs = cooldownSec * 1000;
      const lastAt = lastRpsAttemptByGuildUser.get(cooldownKey) ?? 0;
      if (now - lastAt < cooldownMs) {
        await interaction.reply({
          content: `가위바위보는 ${cooldownSec}초에 한 번만 할 수 있습니다.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      lastRpsAttemptByGuildUser.set(cooldownKey, now);
    }

    try {
      const r = playRockPaperScissors({
        guildId,
        userId,
        playerChoice: choice,
        betAmount: bet,
        rpsMinBet: minBet,
        rpsMaxBet: maxBet,
      });
      recordDailyMissionProgress(
        guildId,
        userId,
        getKstDateString(),
        DAILY_MISSION_KEY_RPS,
      );

      const lines: string[] = [
        `<@${userId}>님: ${r.playerChoice}`,
        `봇: ${r.botChoice}`,
        "",
      ];

      if (r.result === "WIN") {
        lines.push("🎉 승리!", formatSignedCoin(r.balanceDelta), "");
      } else if (r.result === "LOSE") {
        lines.push("💸 패배!", formatSignedCoin(r.balanceDelta), "");
      } else {
        lines.push("🤝 무승부!", "변동 없음", "");
      }

      lines.push(`현재 잔액: ${formatCoin(r.balanceAfter)}`);

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "✊ 가위바위보 결과",
            lines,
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "WALLET_NOT_FOUND") {
          await interaction.reply({
            content: "먼저 `/출석`으로 코인을 받아주세요.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "INSUFFICIENT_CASH") {
          await interaction.reply({
            content: "베팅할 현금이 부족합니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "INVALID_AMOUNT") {
          await interaction.reply({
            content: `베팅은 ${minBet.toLocaleString("ko-KR")}~${maxBet.toLocaleString("ko-KR")} 코인 사이 정수여야 합니다.`,
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
