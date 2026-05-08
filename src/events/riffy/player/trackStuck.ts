import { panelMessage } from "@/utils/discord";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

export default function registerTrackStuck(client: MineClient): void {
  client.riffy.on("trackStuck", async (rawPlayer, rawTrack, thresholdMs) => {
    const player = rawPlayer as ExtendedPlayer;
    const track = rawTrack as ExtendedTrack | undefined;
    const channel = client.channels.cache.get(player.textChannel);

    if (
      !channel ||
      !("send" in channel) ||
      typeof channel.send !== "function"
    ) {
      return;
    }

    await channel
      .send(
        panelMessage({
          panel: {
            eyebrow: "마인 노래 봇",
            title: "재생 멈춤",
            lines: [
              `곡: ${track?.info.title ?? "알 수 없는 곡"}`,
              `임계: ${typeof thresholdMs === "number" ? `${thresholdMs}ms` : "알 수 없음"}`,
            ],
          },
        }),
      )
      .catch(() => undefined);
  });
}
