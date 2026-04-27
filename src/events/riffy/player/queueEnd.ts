import { getSoundroom, isSoundroomTextChannel } from "@/storage/soundroom";
import { panelMessage } from "@/utils/discord";
import { stopSoundroomProgress } from "@/utils/soundroomProgress";
import { editSoundroomIdlePanel } from "@/utils/soundroomPanel";
import type { ExtendedPlayer, MineClient } from "@/types";

export default function registerQueueEnd(client: MineClient): void {
  client.riffy.on("queueEnd", async (rawPlayer) => {
    const initialPlayer = rawPlayer as ExtendedPlayer;

    // Queue/end events can race with pause/resume and next-track transitions.
    // Re-check player state after a short grace period before destructive actions.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const player = (client.riffy.players.get(initialPlayer.guildId) as ExtendedPlayer | undefined) ?? initialPlayer;
    const channel = client.channels.cache.get(player.textChannel);
    if (!channel || !("send" in channel) || typeof channel.send !== "function") {
      return;
    }

    if (player.paused || player.playing || player.queue.length > 0) {
      return;
    }

    const lounge = getSoundroom(player.guildId);
    if (lounge && isSoundroomTextChannel(player.guildId, player.textChannel)) {
      stopSoundroomProgress(player.guildId);
      player.message = undefined;
      await editSoundroomIdlePanel(client, player.guildId).catch(() => undefined);
      await player.destroy();
      return;
    }

    if (player.message) {
      await player.message.delete().catch(() => undefined);
    }

    await player.destroy();
    await channel.send(panelMessage({
      panel: {
        eyebrow: "마인 노래 봇",
        title: "대기열 종료",
        description: "대기열이 비었고 플레이어가 음성 채널에서 나갔습니다.",
      },
    })).catch(() => undefined);
  });
}
