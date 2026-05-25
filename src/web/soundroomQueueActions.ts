import type { GuildMember } from "discord.js";
import { getPlayer } from "@/utils/commands";
import {
  isSoundroomAutoplayTrack,
  setSoundroomQueueUserThenAutoplay,
  splitSoundroomQueue,
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
  SoundroomQueueSwapRequestDto,
  SoundroomQueueSwapSummaryDto,
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

function parseQueueIndexField(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function parseOptionalStringField(
  value: unknown,
): string | null | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return "invalid";
}

export function validateQueueSwapRequest(
  value: unknown,
): SoundroomQueueSwapRequestDto | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as SoundroomQueueSwapRequestDto;
  const fromQueueIndex = parseQueueIndexField(raw.fromQueueIndex);
  const toQueueIndex = parseQueueIndexField(raw.toQueueIndex);
  if (fromQueueIndex === null || toQueueIndex === null) {
    return null;
  }

  const expectedFromUri = parseOptionalStringField(raw.expectedFromUri);
  const expectedFromTitle = parseOptionalStringField(raw.expectedFromTitle);
  const expectedToUri = parseOptionalStringField(raw.expectedToUri);
  const expectedToTitle = parseOptionalStringField(raw.expectedToTitle);
  if (
    expectedFromUri === "invalid" ||
    expectedFromTitle === "invalid" ||
    expectedToUri === "invalid" ||
    expectedToTitle === "invalid"
  ) {
    return null;
  }

  return {
    fromQueueIndex,
    toQueueIndex,
    expectedFromUri,
    expectedFromTitle,
    expectedToUri,
    expectedToTitle,
  };
}

function assertExpectedItemMatches(
  dto: SoundroomQueueItemDto,
  expectedUri: string | null | undefined,
  expectedTitle: string | null | undefined,
): void {
  if (expectedUri !== undefined) {
    const expected = normalizeCompareUri(expectedUri);
    const actual = normalizeCompareUri(dto.uri);
    if (expected !== actual) {
      throw new SoundroomQueueActionError(
        409,
        "QUEUE_ITEM_CHANGED",
        "대기열이 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }
  }
  if (expectedTitle !== undefined) {
    const expected = normalizeCompareTitle(expectedTitle);
    const actual = normalizeCompareTitle(dto.title);
    if (expected !== actual) {
      throw new SoundroomQueueActionError(
        409,
        "QUEUE_ITEM_CHANGED",
        "대기열이 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }
  }
}

function swapUserQueueByDtoIndexes(
  player: ExtendedPlayer,
  fromDtoIndex: number,
  toDtoIndex: number,
): void {
  const { user, autoplay } = splitSoundroomQueue(player);
  if (
    fromDtoIndex < 0 ||
    toDtoIndex < 0 ||
    fromDtoIndex >= user.length ||
    toDtoIndex >= user.length
  ) {
    throw new SoundroomQueueActionError(
      404,
      "QUEUE_ITEM_NOT_FOUND",
      "대기열에서 해당 곡을 찾을 수 없습니다.",
    );
  }
  const nextUser = [...user];
  const fromTrack = nextUser[fromDtoIndex]!;
  nextUser[fromDtoIndex] = nextUser[toDtoIndex]!;
  nextUser[toDtoIndex] = fromTrack;
  setSoundroomQueueUserThenAutoplay(player, nextUser, autoplay);
}

export function swapSoundroomQueueItemsFromWeb(
  client: MineClient,
  guildId: string,
  request: SoundroomQueueSwapRequestDto,
): SoundroomQueueSwapSummaryDto {
  if (request.fromQueueIndex === request.toQueueIndex) {
    throw new SoundroomQueueActionError(
      400,
      "INVALID_QUEUE_SWAP_INDEXES",
      "서로 다른 두 대기열 항목을 선택해 주세요.",
    );
  }

  const player = getPlayer(client, guildId);
  if (!player) {
    throw new SoundroomQueueActionError(
      409,
      "PLAYER_NOT_CONNECTED",
      "봇이 음성 채널에 연결되어 있지 않습니다.",
    );
  }

  const userEntries = userSoundroomQueueEntries(player);
  const fromEntry = userEntries[request.fromQueueIndex];
  const toEntry = userEntries[request.toQueueIndex];
  if (!fromEntry || !toEntry) {
    throw new SoundroomQueueActionError(
      404,
      "QUEUE_ITEM_NOT_FOUND",
      "대기열에서 해당 곡을 찾을 수 없습니다.",
    );
  }

  if (
    isSoundroomAutoplayTrack(fromEntry.track) ||
    isSoundroomAutoplayTrack(toEntry.track)
  ) {
    throw new SoundroomQueueActionError(
      404,
      "QUEUE_ITEM_NOT_FOUND",
      "대기열에서 해당 곡을 찾을 수 없습니다.",
    );
  }

  const currentUri = normalizeCompareUri(player.current?.info.uri);
  for (const entry of [fromEntry, toEntry]) {
    const entryUri = normalizeCompareUri(entry.track.info.uri);
    if (currentUri && entryUri && currentUri === entryUri) {
      throw new SoundroomQueueActionError(
        404,
        "QUEUE_ITEM_NOT_FOUND",
        "현재 재생 중인 곡은 순서를 변경할 수 없습니다.",
      );
    }
  }

  const fromDto = entryToQueueItemDto(fromEntry.track, request.fromQueueIndex);
  const toDto = entryToQueueItemDto(toEntry.track, request.toQueueIndex);

  assertExpectedItemMatches(
    fromDto,
    request.expectedFromUri,
    request.expectedFromTitle,
  );
  assertExpectedItemMatches(toDto, request.expectedToUri, request.expectedToTitle);

  swapUserQueueByDtoIndexes(
    player,
    request.fromQueueIndex,
    request.toQueueIndex,
  );

  syncAutoplayHintFromQueue(guildId, player);
  bumpSoundroomPanelRevision(guildId);
  refreshSoundroomPanelBestEffort(client, guildId, player);

  return { from: fromDto, to: toDto };
}
