import type { GuildMember } from "discord.js";
import { getPlayer } from "@/utils/commands";
import {
  isSoundroomAutoplayTrack,
  syncAutoplayHintFromQueue,
  userSoundroomQueueEntries,
} from "@/utils/soundroomAutoplay";
import { bumpSoundroomPanelRevision } from "@/utils/soundroomPanelRevision";
import {
  editSoundroomIdlePanel,
  editSoundroomPlayingPanel,
} from "@/utils/soundroomPanel";
import type { DiscordOAuthUserDto } from "@/web/types";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";
import type {
  SoundroomQueueItemDto,
  SoundroomQueueRemoveRequestDto,
} from "@/web/types";
export class SoundroomQueueActionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SoundroomQueueActionError";
    this.status = status;
    this.code = code;
  }
}

function resolveRequesterId(requester?: GuildMember): string | null {
  const uid = requester?.user?.id ?? requester?.id;
  return uid ?? null;
}

function resolveRequesterName(requester?: GuildMember): string | null {
  if (!requester) {
    return null;
  }
  const display = requester.displayName?.trim();
  if (display) {
    return display;
  }
  const username = requester.user?.username?.trim();
  return username || null;
}

function entryToQueueItemDto(
  track: ExtendedTrack,
  index: number,
): SoundroomQueueItemDto {
  const uri = track.info.uri?.trim() || null;
  return {
    index,
    title: track.info.title?.trim() || "제목 없음",
    uri,
    author: track.info.author?.trim() || null,
    durationMs:
      typeof track.info.length === "number" && track.info.length > 0
        ? track.info.length
        : null,
    requesterId: resolveRequesterId(track.info.requester),
    requesterName: resolveRequesterName(track.info.requester),
  };
}

function refreshSoundroomPanelBestEffort(
  client: MineClient,
  guildId: string,
  player: ExtendedPlayer,
): void {
  void (async () => {
    try {
      if (player.current || player.playing || player.paused) {
        await editSoundroomPlayingPanel(client, guildId);
      } else {
        await editSoundroomIdlePanel(client, guildId);
      }
    } catch {
      /* 패널 갱신 실패는 API 성공과 분리 */
    }
  })();
}

function normalizeCompareUri(uri: string | null | undefined): string | null {
  const t = uri?.trim();
  return t && t.length > 0 ? t : null;
}

function normalizeCompareTitle(title: string | null | undefined): string | null {
  const t = title?.trim();
  return t && t.length > 0 ? t : null;
}

export function validateQueueRemoveRequest(
  value: unknown,
): SoundroomQueueRemoveRequestDto | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as SoundroomQueueRemoveRequestDto;
  const queueIndex = raw.queueIndex;
  if (
    typeof queueIndex !== "number" ||
    !Number.isInteger(queueIndex) ||
    queueIndex < 0
  ) {
    return null;
  }

  let expectedUri: string | null | undefined;
  if (raw.expectedUri !== undefined) {
    if (raw.expectedUri === null) {
      expectedUri = null;
    } else if (typeof raw.expectedUri === "string") {
      expectedUri = raw.expectedUri;
    } else {
      return null;
    }
  }

  let expectedTitle: string | null | undefined;
  if (raw.expectedTitle !== undefined) {
    if (raw.expectedTitle === null) {
      expectedTitle = null;
    } else if (typeof raw.expectedTitle === "string") {
      expectedTitle = raw.expectedTitle;
    } else {
      return null;
    }
  }

  return {
    queueIndex,
    expectedUri,
    expectedTitle,
  };
}

export function removeSoundroomQueueItemFromWeb(
  client: MineClient,
  guildId: string,
  user: DiscordOAuthUserDto,
  request: SoundroomQueueRemoveRequestDto,
): SoundroomQueueItemDto {
  const player = getPlayer(client, guildId);
  if (!player) {
    throw new SoundroomQueueActionError(
      409,
      "PLAYER_NOT_CONNECTED",
      "봇이 음성 채널에 연결되어 있지 않습니다.",
    );
  }

  const userEntries = userSoundroomQueueEntries(player);
  const entry = userEntries[request.queueIndex];
  if (!entry) {
    throw new SoundroomQueueActionError(
      404,
      "QUEUE_ITEM_NOT_FOUND",
      "대기열에서 해당 곡을 찾을 수 없습니다.",
    );
  }

  const { track, queueIndex: playerQueueIndex } = entry;

  if (isSoundroomAutoplayTrack(track)) {
    throw new SoundroomQueueActionError(
      403,
      "QUEUE_ITEM_NOT_OWNED",
      "본인이 추가한 곡만 삭제할 수 있습니다.",
    );
  }

  const currentUri = normalizeCompareUri(player.current?.info.uri);
  const entryUri = normalizeCompareUri(track.info.uri);
  if (currentUri && entryUri && currentUri === entryUri) {
    throw new SoundroomQueueActionError(
      404,
      "QUEUE_ITEM_NOT_FOUND",
      "현재 재생 중인 곡은 삭제할 수 없습니다.",
    );
  }

  const removedDto = entryToQueueItemDto(track, request.queueIndex);

  if (request.expectedUri !== undefined) {
    const expected = normalizeCompareUri(request.expectedUri);
    const actual = normalizeCompareUri(removedDto.uri);
    if (expected !== actual) {
      throw new SoundroomQueueActionError(
        409,
        "QUEUE_ITEM_CHANGED",
        "대기열이 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }
  }

  if (request.expectedTitle !== undefined) {
    const expected = normalizeCompareTitle(request.expectedTitle);
    const actual = normalizeCompareTitle(removedDto.title);
    if (expected !== actual) {
      throw new SoundroomQueueActionError(
        409,
        "QUEUE_ITEM_CHANGED",
        "대기열이 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }
  }

  const requesterId = removedDto.requesterId;
  if (!requesterId || requesterId !== user.id) {
    throw new SoundroomQueueActionError(
      403,
      "QUEUE_ITEM_NOT_OWNED",
      "본인이 추가한 곡만 삭제할 수 있습니다.",
    );
  }

  try {
    player.queue.remove(playerQueueIndex);
  } catch {
    throw new SoundroomQueueActionError(
      404,
      "QUEUE_ITEM_NOT_FOUND",
      "대기열에서 해당 곡을 찾을 수 없습니다.",
    );
  }

  syncAutoplayHintFromQueue(guildId, player);
  bumpSoundroomPanelRevision(guildId);
  refreshSoundroomPanelBestEffort(client, guildId, player);

  return removedDto;
}
