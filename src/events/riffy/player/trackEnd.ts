import { isSoundroomTextChannel } from "@/storage/soundroom";
import { panelMessage } from "@/utils/discord";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

export default function registerTrackEnd(client: MineClient): void {
  client.riffy.on("trackEnd", async (rawPlayer, rawTrack, rawReason) => {
    const player = rawPlayer as ExtendedPlayer;
    const track = rawTrack as ExtendedTrack | undefined;
    const reason = typeof rawReason === "string" ? rawReason : "finished";
    const channel = client.channels.cache.get(player.textChannel);

    if (!channel || !("send" in channel) || typeof channel.send !== "function") {
      return;
    }

    if (isSoundroomTextChannel(player.guildId, player.textChannel)) {
      return;
    }

    await channel.send(
      panelMessage({
        panel: {
          eyebrow: "마인 노래 봇",
          title: "곡 종료",
          lines: [
            `곡: ${track?.info.title ?? "알 수 없는 곡"}`,
            `사유: ${reason}`,
            `남은 대기열: ${player.queue.length}곡`,
          ],
          subtle: true,
        },
      }),
    ).catch(() => undefined);
  });
}

