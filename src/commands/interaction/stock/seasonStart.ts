import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  createStockSeason,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { canUseStockAdminCommand } from "@/utils/permissions";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const CONFIRM_PHRASE = "시즌시작";

const command: SlashCommand = {
  name: "시즌시작",
  description: "관리자가 서버 코인 랭킹 시즌을 시작합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "이름",
      description: "시즌 이름 (1~30자)",
      required: true,
      minLength: 1,
      maxLength: 30,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "확인",
      description: `실행하려면 정확히 "${CONFIRM_PHRASE}"라고 입력하세요`,
      required: true,
      minLength: 4,
      maxLength: 16,
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

    if (!canUseStockAdminCommand(client, interaction)) {
      await interaction.reply({
        content: "이 명령어는 서버 관리자만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confirm = interaction.options.getString("확인", true).trim();
    if (confirm !== CONFIRM_PHRASE) {
      await interaction.reply({
        content: "확인 문구가 일치하지 않습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const name = interaction.options.getString("이름", true);
    const guildId = interaction.guildId;

    try {
      const season = createStockSeason(guildId, name);
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🏁 시즌 시작",
            lines: [
              `시즌명: \`${season.name}\``,
              "",
              "서버 코인 랭킹 시즌이 시작되었습니다.",
              "시즌 시작 전 초기화가 필요하면 `/서버초기화`를 사용하세요.",
            ],
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "ACTIVE_SEASON_EXISTS") {
          await interaction.reply({
            content: "이 서버에 이미 진행 중인 시즌이 있습니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "INVALID_SEASON_NAME") {
          await interaction.reply({
            content: "시즌 이름은 1~30자로 입력해 주세요.",
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
