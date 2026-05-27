import { ApiClientError } from "./api";
import type {
  SoundroomControlStatusCode,
  SoundroomControlStatusResponseDto,
} from "./types";

const CSRF_UI_MESSAGES: Record<string, string> = {
  CSRF_TOKEN_REQUIRED:
    "요청 보안 토큰이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
  CSRF_TOKEN_INVALID:
    "요청 보안 토큰이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
};

const STATUS_UI_MESSAGES: Record<SoundroomControlStatusCode, string> = {
  READY: "조작 가능 · 같은 노래채널에 있습니다.",
  SOUNDROOM_NOT_CONFIGURED:
    "이 서버에는 노래채널이 설정되어 있지 않습니다.",
  USER_NOT_IN_VOICE_CHANNEL:
    "먼저 Discord 노래채널에 들어가 주세요.",
  PLAYER_NOT_CONNECTED: "봇이 노래채널에 연결되어 있지 않습니다.",
  NOT_SAME_VOICE_CHANNEL:
    "봇과 같은 노래채널에서만 조작할 수 있습니다.",
};

export const QUEUE_ITEM_CHANGED_UI =
  "대기열이 이미 변경되었습니다. 새로고침 후 다시 시도해 주세요.";

function apiErrorMessage(
  err: ApiClientError,
  fallback: Record<string, string>,
): string {
  const mapped =
    err.code && err.code in fallback ? fallback[err.code] : undefined;
  if (err.message.trim().length > 0) {
    return err.message;
  }
  if (mapped) {
    return mapped;
  }
  return err.message;
}

export function mapControlError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code && err.code in CSRF_UI_MESSAGES) {
      return apiErrorMessage(err, CSRF_UI_MESSAGES);
    }
    if (err.code && err.code in STATUS_UI_MESSAGES) {
      return apiErrorMessage(err, STATUS_UI_MESSAGES);
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

export function isControlUnauthorized(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 401;
}

export function isQueueItemChangedError(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === "QUEUE_ITEM_CHANGED";
}

export function controlStatusHeadline(
  code: SoundroomControlStatusCode,
  backendMessage?: string,
): string {
  if (backendMessage?.trim()) {
    return backendMessage.trim();
  }
  return STATUS_UI_MESSAGES[code];
}

const SEARCH_ADD_UI_MESSAGES: Record<string, string> = {
  ...CSRF_UI_MESSAGES,
  INVALID_QUERY: "검색어를 확인해 주세요.",
  INVALID_ADD_REQUEST: "추가 요청이 올바르지 않습니다.",
  INVALID_URL: "지원하지 않거나 올바르지 않은 URL입니다.",
  UNSUPPORTED_URL: "현재 지원하지 않는 URL입니다.",
  NO_SEARCH_RESULTS: "검색 결과를 찾을 수 없습니다.",
  NO_TRACK_LOADED: "노래를 불러오지 못했습니다.",
  PLAYLIST_NOT_SUPPORTED:
    "재생목록 URL은 아래 재생목록 추가를 사용해 주세요.",
  INVALID_PLAYLIST_URL: "지원되는 재생목록 URL을 입력해 주세요.",
  PLAYLIST_EMPTY: "가져올 수 있는 곡이 없는 재생목록입니다.",
  PLAYLIST_TOO_LARGE:
    "재생목록이 너무 큽니다. 일부만 추가하거나 더 작은 목록을 사용해 주세요.",
  LAVALINK_UNAVAILABLE:
    "음악 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
  USER_NOT_IN_VOICE_CHANNEL: "먼저 Discord 노래채널에 들어가 주세요.",
  NOT_SAME_VOICE_CHANNEL: "봇과 같은 노래채널에서만 추가할 수 있습니다.",
  SOUNDROOM_NOT_CONFIGURED: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
};

export function mapSearchAddError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code && err.code in SEARCH_ADD_UI_MESSAGES) {
      return apiErrorMessage(err, SEARCH_ADD_UI_MESSAGES);
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

export function getSearchAddDisabledState(
  soundroomConfigured: boolean,
  controlStatusLoading: boolean,
  controlStatusError: string | null,
  controlStatus: SoundroomControlStatusResponseDto | null,
): { disabled: boolean; reason: string | null } {
  if (!soundroomConfigured) {
    return {
      disabled: true,
      reason: SEARCH_ADD_UI_MESSAGES.SOUNDROOM_NOT_CONFIGURED ?? null,
    };
  }
  if (controlStatusLoading) {
    return { disabled: true, reason: "조작 가능 여부 확인 중…" };
  }
  if (controlStatusError) {
    return { disabled: true, reason: controlStatusError };
  }
  if (!controlStatus) {
    return {
      disabled: true,
      reason: "조작 가능 여부를 확인할 수 없습니다.",
    };
  }
  if (controlStatus.code === "SOUNDROOM_NOT_CONFIGURED") {
    return {
      disabled: true,
      reason: controlStatusHeadline(
        controlStatus.code,
        controlStatus.message,
      ),
    };
  }
  if (controlStatus.code === "USER_NOT_IN_VOICE_CHANNEL") {
    return {
      disabled: true,
      reason: SEARCH_ADD_UI_MESSAGES.USER_NOT_IN_VOICE_CHANNEL ?? null,
    };
  }
  if (controlStatus.code === "NOT_SAME_VOICE_CHANNEL") {
    return {
      disabled: true,
      reason: SEARCH_ADD_UI_MESSAGES.NOT_SAME_VOICE_CHANNEL ?? null,
    };
  }
  if (controlStatus.code === "PLAYER_NOT_CONNECTED") {
    return {
      disabled: false,
      reason: "봇이 아직 음성에 없어도 추가 시 연결됩니다.",
    };
  }
  return { disabled: false, reason: null };
}

const QUEUE_REMOVE_UI_MESSAGES: Record<string, string> = {
  ...CSRF_UI_MESSAGES,
  INVALID_QUEUE_INDEX: "삭제할 대기열 항목이 올바르지 않습니다.",
  QUEUE_ITEM_CHANGED: QUEUE_ITEM_CHANGED_UI,
  QUEUE_ITEM_NOT_FOUND: "대기열에서 해당 곡을 찾을 수 없습니다.",
  QUEUE_ITEM_NOT_OWNED: "본인이 추가한 곡만 삭제할 수 있습니다.",
  PLAYER_NOT_CONNECTED: "봇이 노래채널에 연결되어 있지 않습니다.",
  USER_NOT_IN_VOICE_CHANNEL: "먼저 Discord 노래채널에 들어가 주세요.",
  NOT_SAME_VOICE_CHANNEL: "봇과 같은 노래채널에서만 조작할 수 있습니다.",
  SOUNDROOM_NOT_CONFIGURED: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
};

const QUEUE_SWAP_UI_MESSAGES: Record<string, string> = {
  ...CSRF_UI_MESSAGES,
  INVALID_QUEUE_INDEX: "이동할 대기열 항목이 올바르지 않습니다.",
  INVALID_QUEUE_SWAP_INDEXES: "서로 다른 두 대기열 항목을 선택해 주세요.",
  QUEUE_ITEM_CHANGED: QUEUE_ITEM_CHANGED_UI,
  QUEUE_ITEM_NOT_FOUND: "대기열에서 해당 곡을 찾을 수 없습니다.",
  PLAYER_NOT_CONNECTED: "봇이 노래채널에 연결되어 있지 않습니다.",
  USER_NOT_IN_VOICE_CHANNEL: "먼저 Discord 노래채널에 들어가 주세요.",
  NOT_SAME_VOICE_CHANNEL: "봇과 같은 노래채널에서만 순서를 변경할 수 있습니다.",
  SOUNDROOM_NOT_CONFIGURED: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
};

function mapQueueError(
  err: unknown,
  messages: Record<string, string>,
): string {
  if (err instanceof ApiClientError) {
    if (err.code === "QUEUE_ITEM_CHANGED") {
      return QUEUE_ITEM_CHANGED_UI;
    }
    if (err.code && err.code in messages) {
      return apiErrorMessage(err, messages);
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

export function mapQueueRemoveError(err: unknown): string {
  return mapQueueError(err, QUEUE_REMOVE_UI_MESSAGES);
}

export function mapQueueSwapError(err: unknown): string {
  return mapQueueError(err, QUEUE_SWAP_UI_MESSAGES);
}

const PLAYLIST_UI_MESSAGES: Record<string, string> = {
  ...CSRF_UI_MESSAGES,
  PLAYLIST_NOT_FOUND: "플레이리스트를 찾을 수 없습니다.",
  PLAYLIST_ACCESS_DENIED: "이 플레이리스트를 볼 권한이 없습니다.",
  PLAYLIST_MANAGE_DENIED: "이 플레이리스트를 수정할 권한이 없습니다.",
  PLAYLIST_ADMIN_REQUIRED: "플레이리스트 운영자 권한이 필요합니다.",
  INVALID_PLAYLIST_TITLE: "제목은 1~40자로 입력해 주세요.",
  INVALID_PLAYLIST_DESCRIPTION: "설명은 200자 이내로 입력해 주세요.",
  INVALID_PLAYLIST_VISIBILITY: "공개 범위가 올바르지 않습니다.",
  PLAYLIST_LIMIT_EXCEEDED: "만들 수 있는 플레이리스트 수를 초과했습니다.",
  PUBLIC_PLAYLIST_LIMIT_EXCEEDED:
    "공개 플레이리스트는 최대 5개까지 만들 수 있습니다.",
  PLAYLIST_TRACK_LIMIT_EXCEEDED:
    "한 플레이리스트에는 최대 50곡까지 저장할 수 있습니다.",
  PLAYLIST_TRACK_NOT_FOUND: "플레이리스트에서 곡을 찾을 수 없습니다.",
  INVALID_PLAYLIST_TRACK_ORDER:
    "곡 순서 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.",
  INVALID_PLAYLIST_TRACK_INPUT: "곡 추가 요청이 올바르지 않습니다.",
  PLAYLIST_DELETED: "삭제된 플레이리스트입니다.",
  PLAYLIST_HIDDEN: "운영자에 의해 숨김 처리된 플레이리스트입니다.",
  PLAYLIST_NOT_SUPPORTED:
    "재생목록 URL은 저장할 수 없습니다. 단일 곡만 추가해 주세요.",
  PLAYLIST_EMPTY: "플레이리스트에 곡이 없습니다.",
  PLAYLIST_REPORT_SELF_DENIED: "내가 만든 플레이리스트는 신고할 수 없습니다.",
  PLAYLIST_REPORT_DUPLICATE: "이미 신고한 플레이리스트입니다.",
  INVALID_PLAYLIST_REPORT_REASON: "신고 사유를 선택해 주세요.",
  INVALID_PLAYLIST_REPORT_DETAIL:
    "신고 상세 내용은 300자 이내로 입력해 주세요.",
  PLAYLIST_REPORT_NOT_FOUND: "신고 내역을 찾을 수 없습니다.",
  INVALID_PLAYLIST_REPORT_RESOLUTION:
    "처리 메모는 300자 이내로 입력해 주세요.",
  NO_TRACK_LOADED: "곡을 불러오지 못했습니다.",
  LAVALINK_UNAVAILABLE:
    "음악 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
  USER_NOT_IN_VOICE_CHANNEL: "먼저 Discord 노래채널에 들어가 주세요.",
  NOT_SAME_VOICE_CHANNEL: "봇과 같은 노래채널에서만 추가할 수 있습니다.",
  SOUNDROOM_NOT_CONFIGURED: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
};

export function mapPlaylistError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code && err.code in PLAYLIST_UI_MESSAGES) {
      return apiErrorMessage(err, PLAYLIST_UI_MESSAGES);
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

export function isPlaylistAdminRequired(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === "PLAYLIST_ADMIN_REQUIRED";
}

/** 대기열 삭제: 음성·같은 채널·플레이어 연결 필요 (search/add보다 보수적). */
export function getCanModifyQueue(
  soundroomConfigured: boolean,
  controlStatusLoading: boolean,
  controlStatusError: string | null,
  controlStatus: SoundroomControlStatusResponseDto | null,
): { canModify: boolean; reason: string | null } {
  if (!soundroomConfigured) {
    return {
      canModify: false,
      reason: QUEUE_REMOVE_UI_MESSAGES.SOUNDROOM_NOT_CONFIGURED ?? null,
    };
  }
  if (controlStatusLoading) {
    return { canModify: false, reason: "조작 가능 여부 확인 중…" };
  }
  if (controlStatusError) {
    return { canModify: false, reason: controlStatusError };
  }
  if (!controlStatus) {
    return {
      canModify: false,
      reason: "조작 가능 여부를 확인할 수 없습니다.",
    };
  }
  if (controlStatus.code === "SOUNDROOM_NOT_CONFIGURED") {
    return {
      canModify: false,
      reason: controlStatusHeadline(
        controlStatus.code,
        controlStatus.message,
      ),
    };
  }
  if (controlStatus.code === "USER_NOT_IN_VOICE_CHANNEL") {
    return {
      canModify: false,
      reason: QUEUE_REMOVE_UI_MESSAGES.USER_NOT_IN_VOICE_CHANNEL ?? null,
    };
  }
  if (controlStatus.code === "NOT_SAME_VOICE_CHANNEL") {
    return {
      canModify: false,
      reason: QUEUE_REMOVE_UI_MESSAGES.NOT_SAME_VOICE_CHANNEL ?? null,
    };
  }
  if (controlStatus.code === "PLAYER_NOT_CONNECTED") {
    return {
      canModify: false,
      reason: QUEUE_REMOVE_UI_MESSAGES.PLAYER_NOT_CONNECTED ?? null,
    };
  }
  if (controlStatus.code === "READY") {
    return { canModify: true, reason: null };
  }
  return { canModify: false, reason: controlStatus.message || null };
}
