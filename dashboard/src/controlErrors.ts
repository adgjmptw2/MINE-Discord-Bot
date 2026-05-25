import { ApiClientError } from "./api";
import type {
  SoundroomControlStatusCode,
  SoundroomControlStatusResponseDto,
} from "./types";

const STATUS_UI_MESSAGES: Record<SoundroomControlStatusCode, string> = {
  READY: "조작 가능 · 같은 음성 채널에 있습니다.",
  SOUNDROOM_NOT_CONFIGURED:
    "이 서버에는 노래채널이 설정되어 있지 않습니다.",
  USER_NOT_IN_VOICE_CHANNEL:
    "먼저 Discord 음성 채널에 들어가 주세요.",
  PLAYER_NOT_CONNECTED: "봇이 음성 채널에 연결되어 있지 않습니다.",
  NOT_SAME_VOICE_CHANNEL:
    "봇과 같은 음성 채널에서만 조작할 수 있습니다.",
};

export function mapControlError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code && err.code in STATUS_UI_MESSAGES) {
      return (
        err.message ||
        STATUS_UI_MESSAGES[err.code as SoundroomControlStatusCode]
      );
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

export function isControlUnauthorized(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 401;
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
  INVALID_QUERY: "검색어를 확인해 주세요.",
  INVALID_ADD_REQUEST: "추가 요청이 올바르지 않습니다.",
  INVALID_URL: "지원하지 않거나 올바르지 않은 URL입니다.",
  UNSUPPORTED_URL: "현재 지원하지 않는 URL입니다.",
  NO_SEARCH_RESULTS: "검색 결과를 찾을 수 없습니다.",
  NO_TRACK_LOADED: "노래를 불러오지 못했습니다.",
  PLAYLIST_NOT_SUPPORTED: "재생목록 전체 추가는 아직 지원하지 않습니다.",
  USER_NOT_IN_VOICE_CHANNEL: "먼저 Discord 노래채널에 들어가 주세요.",
  NOT_SAME_VOICE_CHANNEL: "봇과 같은 노래채널에서만 추가할 수 있습니다.",
  SOUNDROOM_NOT_CONFIGURED: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
};

export function mapSearchAddError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code && err.code in SEARCH_ADD_UI_MESSAGES) {
      return err.message || SEARCH_ADD_UI_MESSAGES[err.code]!;
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
  INVALID_QUEUE_INDEX: "삭제할 대기열 항목이 올바르지 않습니다.",
  QUEUE_ITEM_CHANGED:
    "대기열이 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
  QUEUE_ITEM_NOT_FOUND: "대기열에서 해당 곡을 찾을 수 없습니다.",
  QUEUE_ITEM_NOT_OWNED: "본인이 추가한 곡만 삭제할 수 있습니다.",
  PLAYER_NOT_CONNECTED: "봇이 노래채널에 연결되어 있지 않습니다.",
  USER_NOT_IN_VOICE_CHANNEL: "먼저 Discord 노래채널에 들어가 주세요.",
  NOT_SAME_VOICE_CHANNEL: "봇과 같은 노래채널에서만 삭제할 수 있습니다.",
  SOUNDROOM_NOT_CONFIGURED: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
};

export function mapQueueRemoveError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code && err.code in QUEUE_REMOVE_UI_MESSAGES) {
      return err.message || QUEUE_REMOVE_UI_MESSAGES[err.code]!;
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
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
