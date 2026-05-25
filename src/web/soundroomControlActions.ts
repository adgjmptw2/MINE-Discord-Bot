import { stopSoundroomProgress } from "@/utils/soundroomProgress";
import {
  editSoundroomIdlePanel,
  editSoundroomPlayingPanel,
  type BuildSoundroomPanelOptions,
} from "@/utils/soundroomPanel";
import { bumpSoundroomPanelRevision } from "@/utils/soundroomPanelRevision";
import {
  prefetchAutoplayNextHint,
  removeAutoplayTracksFromQueue,
  resetAutoplaySession,
  toggleAutoplay,
} from "@/utils/soundroomAutoplay";
import { getPlayer, hasControllableTrack } from "@/utils/commands";
import type { ExtendedPlayer, MineClient } from "@/types";
import { log } from "@/utils/logger";

const MIN_VOLUME = 0;
const MAX_VOLUME = 150;

function logControlWarn(action: string, guildId: string, error: unknown): void {
  const message =
    error instanceof Error
      ? error.message.slice(0, 160)
      : String(error).slice(0, 160);
  log("warn", "web", `Soundroom control ${action} guild=${guildId} ${message}`);
}

function refreshSoundroomPanelBestEffort(
  client: MineClient,
  guildId: string,
): void {
  void (async () => {
    const pl = getPlayer(client, guildId);
    try {
      if (pl?.current) {
        await editSoundroomPlayingPanel(client, guildId);
      } else {
        await editSoundroomIdlePanel(client, guildId);
      }
    } catch (error) {
      logControlWarn("panel-refresh", guildId, error);
    }
  })();
}

export function isValidSoundroomVolume(volume: number): boolean {
  return (
    Number.isInteger(volume) && volume >= MIN_VOLUME && volume <= MAX_VOLUME
  );
}

export async function executeSoundroomTogglePause(
  client: MineClient,
  guildId: string,
  player: ExtendedPlayer,
): Promise<void> {
  if (!hasControllableTrack(player)) {
    throw new ControlNothingPlayingError();
  }

  bumpSoundroomPanelRevision(guildId);
  await Promise.resolve(player.pause(!player.paused));
  refreshSoundroomPanelBestEffort(client, guildId);
}

/** skip 직후 패널 즉시 edit 없음 — trackStart/idle 흐름에 맡김 */
export async function executeSoundroomSkip(
  _client: MineClient,
  _guildId: string,
  player: ExtendedPlayer,
): Promise<void> {
  if (!hasControllableTrack(player)) {
    throw new ControlNothingPlayingError();
  }

  await Promise.resolve(player.stop());
}

export async function executeSoundroomStop(
  client: MineClient,
  guildId: string,
  player: ExtendedPlayer,
): Promise<void> {
  resetAutoplaySession(guildId);
  player.queue.clear();
  stopSoundroomProgress(guildId);
  bumpSoundroomPanelRevision(guildId);
  player.message = undefined;

  try {
    await Promise.resolve(player.destroy());
  } catch (error) {
    logControlWarn("stop-destroy", guildId, error);
  }

  const lightIdleOpts: BuildSoundroomPanelOptions = {
    includeMedia: false,
    skipLocalIdleAttachment: true,
  };

  void editSoundroomIdlePanel(client, guildId, lightIdleOpts).catch((error) => {
    logControlWarn("stop-panel", guildId, error);
  });
}

export async function executeSoundroomToggleAutoplay(
  client: MineClient,
  guildId: string,
): Promise<void> {
  const enabled = toggleAutoplay(guildId);
  bumpSoundroomPanelRevision(guildId);
  const pl = getPlayer(client, guildId);

  if (pl && !enabled) {
    removeAutoplayTracksFromQueue(pl);
  }

  if (pl?.current) {
    refreshSoundroomPanelBestEffort(client, guildId);
    if (enabled) {
      void prefetchAutoplayNextHint(client, pl).then(() => {
        refreshSoundroomPanelBestEffort(client, guildId);
      });
    }
  } else {
    void editSoundroomIdlePanel(client, guildId).catch((error) => {
      logControlWarn("toggleAutoplay-panel", guildId, error);
    });
  }
}

export async function executeSoundroomSetVolume(
  client: MineClient,
  guildId: string,
  player: ExtendedPlayer,
  volume: number,
): Promise<void> {
  bumpSoundroomPanelRevision(guildId);
  await Promise.resolve(player.setVolume(volume));
  refreshSoundroomPanelBestEffort(client, guildId);
}

export class ControlNothingPlayingError extends Error {
  readonly code = "NOTHING_PLAYING";

  constructor() {
    super("현재 재생 중인 곡이 없습니다.");
    this.name = "ControlNothingPlayingError";
  }
}
