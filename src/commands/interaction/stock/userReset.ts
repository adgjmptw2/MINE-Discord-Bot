import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { resetStockUserData } from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { canUseStockAdminCommand } from "@/utils/permissions";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const CONFIRM_PHRASE = "초기화";

const command: SlashCommand = {
  name: "유저초기화",
  description: "관리자가 특정 유저의 코인/주식 데이터를 초기화합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "유저",
      description: "데이터를 초기화할 유저",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "확인",
      description: `실행하려면 정확히 "${CONFIRM_PHRASE}"라고 입력하세요`,
      required: true,
      minLength: 3,
      maxLength: 20,
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

    const target = interaction.options.getUser("유저", true);
    const guildId = interaction.guildId;

    const counts = resetStockUserData(guildId, target.id);

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🧹 유저 데이터 초기화 완료",
          lines: [
            `<@${target.id}>님의 코인/주식 데이터가 초기화되었습니다.`,
            "",
            `삭제된 지갑: ${counts.deletedWallets.toLocaleString("ko-KR")}개`,
            `삭제된 보유 종목: ${counts.deletedHoldings.toLocaleString("ko-KR")}개`,
            `삭제된 거래 기록: ${counts.deletedTrades.toLocaleString("ko-KR")}개`,
            `삭제된 출석 기록: ${counts.deletedAttendances.toLocaleString("ko-KR")}개`,
            `삭제된 던전 기록: ${counts.deletedDungeonRuns.toLocaleString("ko-KR")}개`,
            `삭제된 소비 아이템: ${counts.deletedConsumables.toLocaleString("ko-KR")}개`,
            `삭제된 검: ${counts.deletedSwords.toLocaleString("ko-KR")}개`,
          ],
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;
