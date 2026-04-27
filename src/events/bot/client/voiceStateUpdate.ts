import { getPlayer } from "@/utils/commands";
import { panelMessage } from "@/utils/discord";
import { getSoundroom } from "@/storage/soundroom";
import { stopSoundroomProgress } from "@/utils/soundroomProgress";
import { editSoundroomIdlePanel } from "@/utils/soundroomPanel";
import type { MineClient } from "@/types";

const VOICE_LEAVE_NOTICE_DELETE_MS = 15_000;

export default function registerVoiceStateUpdate(client: MineClient): void {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    const player = getPlayer(client, oldState.guild.id);

    if (!player || !client.user) {
      return;
    }

    const textChannel = client.channels.cache.get(player.textChannel);
    if (!textChannel || !("send" in textChannel) || typeof textChannel.send !== "function") {
      return;
    }

    if (oldState.id === client.user.id && oldState.channelId && !newState.channelId) {
      return;
    }

    const previousBotChannel = oldState.guild.members.me?.voice.channel;

    if (previousBotChannel && oldState.channelId === previousBotChannel.id) {
      const listeners = previousBotChannel.members.filter((member) => !member.user.bot);

      if (listeners.size === 0) {
        const guildId = oldState.guild.id;

        player.queue.clear();
        stopSoundroomProgress(guildId);
        player.message = undefined;
        await player.destroy();

        if (getSoundroom(guildId)) {
          await editSoundroomIdlePanel(client, guildId).catch(() => undefined);
        }

        const sent = await textChannel.send(
          panelMessage({
            panel: {
              eyebrow: "음성 채널",
              title: "퇴장",
              description: "남아있는 사용자가 없습니다. 음성 채널을 떠납니다.",
            },
          }),
        );

        setTimeout(() => {
          void sent.delete().catch(() => undefined);
        }, VOICE_LEAVE_NOTICE_DELETE_MS);
      }
    }
  });
}
