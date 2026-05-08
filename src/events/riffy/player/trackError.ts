import { inspect } from "node:util";
import { isSoundroomTextChannel } from "@/storage/soundroom";
import { panelMessage, truncate } from "@/utils/discord";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

/** Riffy/Lavalink `TrackExceptionEvent` 전체가 넘어오므로, 사람이 읽을 수 있는 문자열로 만듭니다. */
function formatTrackErrorPayload(errorPayload: unknown): string {
  if (errorPayload instanceof Error) {
    return errorPayload.message;
  }
  if (errorPayload == null) {
    return "알 수 없는 재생 오류";
  }
  if (typeof errorPayload === "string") {
    return errorPayload;
  }
  if (typeof errorPayload !== "object") {
    return String(errorPayload);
  }

  const p = errorPayload as Record<string, unknown>;
  const ex = p.exception;
  if (ex && typeof ex === "object") {
    const e = ex as Record<string, unknown>;
    const msg = e.message;
    if (typeof msg === "string" && msg.length > 0) {
      const sev = e.severity;
      const suffix = typeof sev === "string" ? ` (${sev})` : "";
      return `${msg}${suffix}`;
    }
  }

  const direct = p.message;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  try {
    return JSON.stringify(errorPayload);
  } catch {
    return inspect(errorPayload, { depth: 3, breakLength: 120 });
  }
}

export default function registerTrackError(client: MineClient): void {
  client.riffy.on("trackError", async (rawPlayer, rawTrack, errorPayload) => {
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

    if (isSoundroomTextChannel(player.guildId, player.textChannel)) {
      return;
    }

    const detail = truncate(formatTrackErrorPayload(errorPayload), 900);

    await channel
      .send(
        panelMessage({
          panel: {
            eyebrow: "마인 노래 봇",
            title: "재생 오류",
            lines: [
              `곡: ${track?.info.title ?? "알 수 없는 곡"}`,
              `내용: ${detail}`,
            ],
          },
        }),
      )
      .catch(() => undefined);
  });
}
