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
