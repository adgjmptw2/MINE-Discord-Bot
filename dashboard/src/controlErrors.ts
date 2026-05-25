import { ApiClientError } from "./api";
import type { SoundroomControlStatusCode } from "./types";

const STATUS_UI_MESSAGES: Record<SoundroomControlStatusCode, string> = {
  READY: "조작 가능 · 같은 음성 채널에 있습니다.",
  SOUNDROOM_NOT_CONFIGURED:
    "이 서버에는 Soundroom이 설정되어 있지 않습니다.",
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
