import {
  buildFortuneIntroReply,
  buildFortuneProfileLoadFailedReply,
  buildStoredProfileFortuneReply,
} from "@/handlers/fortuneInteractions";
import { getFortuneProfile, hasFortuneProfile } from "@/storage/fortuneProfile";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const FORTUNE_EPHEMERAL_DELETE_MS = 60_000;

const command: SlashCommand = {
  name: "오늘운세",
  description: "저장형 또는 일회용으로 오늘의 재미용 운세를 확인합니다.",
  category: "utility",
  guildOnly: true,
  options: [],

  async run(_client: MineClient, interaction) {
    const uid = interaction.user.id;
    const profile = getFortuneProfile(uid);
    if (profile) {
      await interaction.reply(buildStoredProfileFortuneReply(uid, profile));
    } else if (hasFortuneProfile(uid)) {
      await interaction.reply(buildFortuneProfileLoadFailedReply());
    } else {
      await interaction.reply(buildFortuneIntroReply());
    }
    scheduleEphemeralReplyDelete(interaction, FORTUNE_EPHEMERAL_DELETE_MS);
  },
};

export default command;
