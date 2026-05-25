import type { MineClient } from "@/types";
import { getSoundroom } from "@/storage/soundroom";
import { getPlayer } from "@/utils/commands";
import { editSoundroomPlayingPanel } from "@/utils/soundroomPanel";

const intervals = new Map<string, ReturnType<typeof setInterval>>();
const inFlightGuilds = new Set<string>();

const TICK_MS = 8000;

async function runSoundroomProgressTick(
  client: MineClient,
  guildId: string,
): Promise<void> {
  if (inFlightGuilds.has(guildId)) {
    return;
  }

  inFlightGuilds.add(guildId);
  try {
    const lounge = getSoundroom(guildId);
    if (!lounge) {
      stopSoundroomProgress(guildId);
      return;
    }

    const player = getPlayer(client, guildId);
    if (!player?.playing || !player.current) {
      return;
    }

    if (player.textChannel !== lounge.channelId) {
      return;
    }

    await editSoundroomPlayingPanel(client, guildId).catch(() => undefined);
  } finally {
    inFlightGuilds.delete(guildId);
  }
}

export function startSoundroomProgress(
  client: MineClient,
  guildId: string,
): void {
  stopSoundroomProgress(guildId);

  void runSoundroomProgressTick(client, guildId);

  const id = setInterval(() => {
    void runSoundroomProgressTick(client, guildId);
  }, TICK_MS);

  intervals.set(guildId, id);
}

export function stopSoundroomProgress(guildId: string): void {
  const existing = intervals.get(guildId);
  if (existing) {
    clearInterval(existing);
    intervals.delete(guildId);
  }
  inFlightGuilds.delete(guildId);
}
