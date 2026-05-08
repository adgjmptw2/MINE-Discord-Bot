import { getSoundroom, isSoundroomTextChannel } from "@/storage/soundroom";
import { panelMessage } from "@/utils/discord";
import { stopSoundroomProgress } from "@/utils/soundroomProgress";
import { editSoundroomIdlePanel } from "@/utils/soundroomPanel";
import {
  armIdleLeaveTimer,
  ensureSeedTrack,
  resetAutoplaySession,
  setLastEndedTrack,
  tryEnqueueAutoplayPlaylist,
} from "@/utils/soundroomAutoplay";
import type { ExtendedPlayer, MineClient } from "@/types";

const IDLE_LEAVE_MS = 60_000;

export default function registerQueueEnd(client: MineClient): void {
  client.riffy.on("queueEnd", async (rawPlayer) => {
    const initialPlayer = rawPlayer as ExtendedPlayer;

    await new Promise((resolve) => setTimeout(resolve, 400));

    const player =
      (client.riffy.players.get(initialPlayer.guildId) as
        | ExtendedPlayer
        | undefined) ?? initialPlayer;
    const channel = client.channels.cache.get(player.textChannel);
    if (
      !channel ||
      !("send" in channel) ||
      typeof channel.send !== "function"
    ) {
      return;
    }

    if (player.paused || player.queue.length > 0) {
      return;
    }

    const guildId = player.guildId;
    const lounge = getSoundroom(guildId);

    if (lounge && isSoundroomTextChannel(guildId, player.textChannel)) {
      /** 큐가 비며 끝난 경우도 마지막 곡 기준으로 자동재생을 이어 갑니다. */
      const ended = player.previous;
      if (ended) {
        setLastEndedTrack(guildId, ended);
        ensureSeedTrack(guildId, ended);
      }
      const ok = await tryEnqueueAutoplayPlaylist(client, player).catch(
        () => false,
      );
      if (ok) {
        return;
      }

      stopSoundroomProgress(guildId);
      player.message = undefined;
      await editSoundroomIdlePanel(client, guildId).catch(() => undefined);

      armIdleLeaveTimer(guildId, IDLE_LEAVE_MS, () => {
        void (async () => {
          const p = client.riffy.players.get(guildId) as
            | ExtendedPlayer
            | undefined;
          if (!p) {
            resetAutoplaySession(guildId);
            return;
          }
          if (p.queue.length > 0 || p.playing || p.paused) {
            return;
          }
          stopSoundroomProgress(guildId);
          p.message = undefined;
          if (getSoundroom(guildId)) {
            await editSoundroomIdlePanel(client, guildId).catch(
              () => undefined,
            );
          }
          try {
            await Promise.resolve(p.destroy());
          } catch {
            /* 이미 끊긴 플레이어면 넘어감 */
          }
          resetAutoplaySession(guildId);
        })();
      });
      return;
    }

    if (player.message) {
      await player.message.delete().catch(() => undefined);
    }

    await player.destroy();
    await channel
      .send(
        panelMessage({
          panel: {
            eyebrow: "마인 노래 봇",
            title: "대기열 종료",
            description: "대기열이 비었고 플레이어가 음성 채널에서 나갔습니다.",
          },
        }),
      )
      .catch(() => undefined);
  });
}
