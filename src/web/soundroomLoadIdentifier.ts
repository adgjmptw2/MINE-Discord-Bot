import { isExplicitFullPlaylistIntentUrl } from "@/events/bot/client/soundroomMessages";
import { stripSearchEnginePrefix } from "@/utils/riffyResolve";
import { sanitizeYoutubeQueryForLavalink } from "@/utils/youtubeLavalinkQuery";

/** 검색어·URL 입력 최대 길이 */
export const SOUNDROOM_QUERY_MAX_LENGTH = 300;

const HTTP_URL_RE = /^https?:\/\//i;
const SEARCH_PREFIX_RE = /^[a-z][a-z0-9]*:/i;

const YT_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const SPOTIFY_TRACK_RE = /open\.spotify\.com\/track\//i;

export class SoundroomLoadIdentifierError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SoundroomLoadIdentifierError";
    this.code = code;
  }
}

export function normalizeSoundroomQuery(input: string): string {
  return input.trim();
}

function youtubeHost(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

export function isYoutubeSoundroomUrl(input: string): boolean {
  const q = normalizeSoundroomQuery(input);
  if (!HTTP_URL_RE.test(q)) {
    return false;
  }
  try {
    const u = new URL(q);
    return YT_HOSTS.has(youtubeHost(u.hostname));
  } catch {
    return false;
  }
}

export function isSpotifyTrackUrl(input: string): boolean {
  return SPOTIFY_TRACK_RE.test(normalizeSoundroomQuery(input));
}

export function isUnsupportedSpotifyUrl(input: string): boolean {
  const q = normalizeSoundroomQuery(input).toLowerCase();
  if (!q.includes("open.spotify.com")) {
    return false;
  }
  if (SPOTIFY_TRACK_RE.test(q)) {
    return false;
  }
  return true;
}

export function isSupportedSoundroomUrl(input: string): boolean {
  const q = normalizeSoundroomQuery(input);
  if (!HTTP_URL_RE.test(q)) {
    return false;
  }
  if (isUnsupportedSpotifyUrl(q)) {
    return false;
  }
  if (isYoutubeSoundroomUrl(q)) {
    return true;
  }
  if (isSpotifyTrackUrl(q)) {
    return true;
  }
  return false;
}

export function validateSoundroomQueryInput(input: string): string {
  const q = normalizeSoundroomQuery(input);
  if (!q) {
    throw new SoundroomLoadIdentifierError("INVALID_QUERY", "검색어를 입력해 주세요.");
  }
  if (q.length > SOUNDROOM_QUERY_MAX_LENGTH) {
    throw new SoundroomLoadIdentifierError(
      "INVALID_QUERY",
      `검색어는 ${SOUNDROOM_QUERY_MAX_LENGTH}자 이하로 입력해 주세요.`,
    );
  }
  return q;
}

/**
 * Lavalink/Riffy resolve에 넘길 identifier를 만듭니다.
 * 검색어는 ytsearch: 접두사만 사용하고 Spotify URL prefix와 결합하지 않습니다.
 */
export function buildSoundroomLoadIdentifier(input: string): string {
  const q = validateSoundroomQueryInput(input);

  if (HTTP_URL_RE.test(q)) {
    if (isUnsupportedSpotifyUrl(q)) {
      throw new SoundroomLoadIdentifierError(
        "UNSUPPORTED_URL",
        "지원하지 않는 주소입니다. YouTube URL 또는 검색어를 사용해 주세요.",
      );
    }
    if (isSpotifyTrackUrl(q)) {
      // patchRiffyResolve가 oEmbed 제목 검색으로 변환 — URL에 ytsearch를 붙이지 않음
      return q;
    }
    if (isYoutubeSoundroomUrl(q)) {
      return sanitizeYoutubeQueryForLavalink(q);
    }
    throw new SoundroomLoadIdentifierError(
      "INVALID_URL",
      "올바른 YouTube URL이 아닙니다.",
    );
  }

  if (SEARCH_PREFIX_RE.test(q)) {
    const stripped = stripSearchEnginePrefix(q);
    if (!stripped) {
      throw new SoundroomLoadIdentifierError("INVALID_QUERY", "검색어를 입력해 주세요.");
    }
    return `ytsearch:${stripped}`;
  }

  return `ytsearch:${q}`;
}

const UNSAFE_URL_PROTOCOL_RE = /^(javascript|data|file):/i;

export const SOUNDROOM_PLAYLIST_MAX_TRACKS = 50;
export const SOUNDROOM_PLAYLIST_DEFAULT_LIMIT = 50;

/** 재생목록 import limit: 기본 50, 1~50으로 clamp */
export function clampSoundroomPlaylistLimit(limit: unknown): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return SOUNDROOM_PLAYLIST_DEFAULT_LIMIT;
  }
  const n = Math.floor(limit);
  return Math.min(SOUNDROOM_PLAYLIST_MAX_TRACKS, Math.max(1, n));
}

export function isExplicitPlaylistUrlInput(input: string): boolean {
  return isExplicitFullPlaylistIntentUrl(normalizeSoundroomQuery(input));
}

/**
 * /add-playlist 전용 URI 검증. 단일 곡·검색어·지원 불가 Spotify 재생목록은 거절.
 */
export function assertSafeHttpPlaylistUri(uri: string): string {
  const q = validateSoundroomQueryInput(uri);

  if (!HTTP_URL_RE.test(q)) {
    throw new SoundroomLoadIdentifierError(
      "INVALID_PLAYLIST_URL",
      "지원되는 재생목록 URL을 입력해 주세요.",
    );
  }
  if (UNSAFE_URL_PROTOCOL_RE.test(q)) {
    throw new SoundroomLoadIdentifierError(
      "INVALID_PLAYLIST_URL",
      "지원되지 않는 주소 형식입니다.",
    );
  }
  if (isUnsupportedSpotifyUrl(q)) {
    throw new SoundroomLoadIdentifierError(
      "PLAYLIST_NOT_SUPPORTED",
      "아직 지원하지 않는 재생목록 형식입니다.",
    );
  }
  if (!isExplicitPlaylistUrlInput(q)) {
    if (isSpotifyTrackUrl(q) || (isYoutubeSoundroomUrl(q) && !/list=/i.test(q))) {
      throw new SoundroomLoadIdentifierError(
        "INVALID_PLAYLIST_URL",
        "단일 곡은 일반 추가를 사용해 주세요.",
      );
    }
    throw new SoundroomLoadIdentifierError(
      "INVALID_PLAYLIST_URL",
      "지원되는 재생목록 URL을 입력해 주세요.",
    );
  }
  return q;
}

export function buildPlaylistLoadIdentifier(uri: string): string {
  const q = assertSafeHttpPlaylistUri(uri);
  if (isYoutubeSoundroomUrl(q)) {
    return sanitizeYoutubeQueryForLavalink(q);
  }
  return q;
}
