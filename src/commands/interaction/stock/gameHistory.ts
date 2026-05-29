import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import { listCoinGameLogs, type CoinGameLogEntry } from "@/storage/stock";
import { panelReply, truncate } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { formatSignedCoin } from "@/utils/stockFormat";
import { canUseStockAdminCommand } from "@/utils/permissions";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

/** 패널에 보여 줄 최대 건수 (조회 limit과 별도) */
const MAX_DISPLAY_LINES = 7;

function gameTypeLabel(gameType: string): string {
  if (gameType === "RPS") {
    return "가위바위보";
  }
  return gameType;
}

function resultLabel(result: string): string {
  if (result === "WIN") {
    return "승리";
  }
  if (result === "LOSE") {
    return "패배";
  }
  if (result === "DRAW") {
    return "무승부";
  }
  return result;
}

function buildGameLogLine(
  e: CoinGameLogEntry,
  includeChoices: boolean,
): string {
  const game = gameTypeLabel(e.gameType);
  const rk = resultLabel(e.result);
  let line = `${game} ${rk} · ${formatSignedCoin(e.balanceDelta)}`;
  if (
    includeChoices &&
    e.metadata?.playerChoice &&
    e.metadata?.botChoice
  ) {
    line += ` · ${e.metadata.playerChoice} / ${e.metadata.botChoice}`;
  }
  return truncate(line, 400);
}

const command: SlashCommand = {
  name: "게임기록",
  description: "최근 코인 미니게임 기록을 확인합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "유저",
      description: "조회할 유저 (관리자만 다른 사람 지정 가능)",
      required: false,
    },
    {
      type: ApplicationCommandOptionType.Integer,
      name: "개수",
      description: "조회할 최대 개수 (1~20, 기본 10)",
      required: false,
      minValue: 1,
      maxValue: 20,
    },
  ],

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;
    const optionalUser = interaction.options.getUser("유저");
    const countRaw = interaction.options.getInteger("개수");
    const limit = countRaw === null ? undefined : countRaw;

    let targetUserId = interaction.user.id;
    if (optionalUser && optionalUser.id !== interaction.user.id) {
      if (!canUseStockAdminCommand(client, interaction)) {
        await interaction.reply({
          content:
            "다른 유저의 게임 기록은 서버 관리자 또는 봇 운영자만 조회할 수 있습니다.",
          flags: MessageFlags.Ephemeral,
        });
        scheduleEphemeralReplyDelete(interaction);
        return;
      }
      targetUserId = optionalUser.id;
    }

    const entries = listCoinGameLogs({
      guildId,
      userId: targetUserId,
      limit,
    });

    if (entries.length === 0) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "🎮 게임기록",
            description: "최근 게임 기록이 없습니다.",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const slice = entries.slice(0, MAX_DISPLAY_LINES);
    const lines = slice.map((e, i) =>
      buildGameLogLine(
        e,
        i < 3 &&
          Boolean(e.metadata?.playerChoice && e.metadata?.botChoice),
      ),
    );
    if (entries.length > slice.length) {
      lines.push(`외 ${entries.length - slice.length}건`);
    }

    const countLabel = `최근 ${entries.length}건`;
    const description =
      targetUserId !== interaction.user.id
        ? `${countLabel} · 조회: <@${targetUserId}>`
        : countLabel;

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🎮 게임기록",
          description,
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;
