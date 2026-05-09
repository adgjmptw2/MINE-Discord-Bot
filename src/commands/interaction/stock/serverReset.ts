import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { resetStockGuildData } from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { canUseStockAdminCommand } from "@/utils/permissions";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const CONFIRM_PHRASE = "서버초기화";

const command: SlashCommand = {
  name: "서버초기화",
  description: "관리자가 이 서버의 코인/주식 데이터를 전체 초기화합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "확인",
      description: `실행하려면 정확히 "${CONFIRM_PHRASE}"라고 입력하세요`,
      required: true,
      minLength: 5,
      maxLength: 32,
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

    const guildId = interaction.guildId;
    const counts = resetStockGuildData(guildId);

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🧹 서버 경제 초기화 완료",
          lines: [
            `초기화된 지갑: ${counts.deletedWallets.toLocaleString("ko-KR")}개`,
            `삭제된 보유 종목: ${counts.deletedHoldings.toLocaleString("ko-KR")}개`,
            `삭제된 거래 기록: ${counts.deletedTrades.toLocaleString("ko-KR")}개`,
            `삭제된 출석 기록: ${counts.deletedAttendances.toLocaleString("ko-KR")}개`,
            "",
            "이 서버의 코인/주식 데이터가 초기화되었습니다.",
          ],
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;
