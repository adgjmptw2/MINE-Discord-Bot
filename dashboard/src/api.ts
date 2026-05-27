import type {
  ApiErrorResponse,
  AuthCsrfResponse,
  AuthGuildsResponse,
  AuthMeResponse,
  AuthSoundroomStateResponse,
  SoundroomAddRequestDto,
  SoundroomAddResponseDto,
  SoundroomPlaylistAddRequestDto,
  SoundroomPlaylistAddResponseDto,
  SoundroomControlRequestDto,
  SoundroomControlResponseDto,
  SoundroomControlStatusResponseDto,
  SoundroomQueueRemoveRequestDto,
  SoundroomQueueRemoveResponseDto,
  SoundroomQueueSwapRequestDto,
  SoundroomQueueSwapResponseDto,
  SoundroomSearchResponseDto,
  WebPlaylistAddToQueueRequestDto,
  WebPlaylistAddToQueueResponseDto,
  WebPlaylistAdminHideRequestDto,
  WebPlaylistAdminHideResponseDto,
  WebPlaylistAdminListHiddenFilter,
  WebPlaylistAdminListResponseDto,
  WebPlaylistCreateRequestDto,
  WebPlaylistCreateResponseDto,
  WebPlaylistDetailResponseDto,
  WebPlaylistDeleteResponseDto,
  WebPlaylistMineResponseDto,
  WebPlaylistPublicListResponseDto,
  WebPlaylistTrackAddRequestDto,
  WebPlaylistTrackAddResponseDto,
  WebPlaylistTrackReorderRequestDto,
  WebPlaylistTrackReorderResponseDto,
  WebPlaylistUpdateRequestDto,
} from "./types";

const DEFAULT_API_BASE = "http://127.0.0.1:3077";

const NETWORK_ERROR_MESSAGE =
  "API 서버에 연결할 수 없습니다. 봇이 켜져 있는지, 대시보드 주소가 .env의 WEB_DASHBOARD_ALLOWED_ORIGIN과 같은 호스트(127.0.0.1 vs localhost)인지 확인하세요.";

const CSRF_RETRY_CODES = new Set([
  "CSRF_TOKEN_REQUIRED",
  "CSRF_TOKEN_INVALID",
]);

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/** 메모리만 사용. localStorage/sessionStorage에 저장하지 않는다. */
let csrfTokenCache: string | null = null;

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_WEB_API_BASE_URL?.trim();
  if (raw && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_API_BASE;
}

export function getDiscordLoginUrl(): string {
  return `${getApiBaseUrl()}/api/auth/discord/login`;
}

export function clearCsrfTokenCache(): void {
  csrfTokenCache = null;
}

export async function getCsrfToken(signal?: AbortSignal): Promise<string> {
  const data = await apiFetch<AuthCsrfResponse>("/api/auth/csrf", { signal });
  return data.csrfToken;
}

export async function getCachedCsrfTokenOrFetch(
  signal?: AbortSignal,
): Promise<string> {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }
  const token = await getCsrfToken(signal);
  csrfTokenCache = token;
  return token;
}

async function parseJsonBody(text: string): Promise<unknown> {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiClientError(NETWORK_ERROR_MESSAGE, 0);
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError(NETWORK_ERROR_MESSAGE, 0);
  }

  const text = await res.text();
  const data = await parseJsonBody(text);

  if (!res.ok) {
    if (res.status === 401) {
      clearCsrfTokenCache();
    }
    const err = data as ApiErrorResponse | null;
    const message =
      err && typeof err === "object" && "message" in err && err.message
        ? String(err.message)
        : "요청에 실패했습니다.";
    const code =
      err && typeof err === "object" && "code" in err && err.code
        ? String(err.code)
        : undefined;
    throw new ApiClientError(message, res.status, code);
  }

  return data as T;
}

/** CSRF 실패 시 캐시 비우고 1회만 재시도한다. */
async function apiPost<T>(
  path: string,
  body: unknown | undefined,
  init?: RequestInit,
): Promise<T> {
  const run = async (allowCsrfRetry: boolean): Promise<T> => {
    try {
      const csrfToken = await getCachedCsrfTokenOrFetch(init?.signal);
      return await apiFetch<T>(path, {
        ...init,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          ...init?.headers,
        },
        body:
          body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      if (
        allowCsrfRetry &&
        err instanceof ApiClientError &&
        err.code &&
        CSRF_RETRY_CODES.has(err.code)
      ) {
        clearCsrfTokenCache();
        return run(false);
      }
      throw err;
    }
  };
  return run(true);
}

async function apiWriteWithCsrf<T>(
  method: "PATCH" | "DELETE",
  path: string,
  body: unknown | undefined,
  init?: RequestInit,
): Promise<T> {
  const run = async (allowCsrfRetry: boolean): Promise<T> => {
    try {
      const csrfToken = await getCachedCsrfTokenOrFetch(init?.signal);
      return await apiFetch<T>(path, {
        ...init,
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          "X-CSRF-Token": csrfToken,
          ...init?.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      if (
        allowCsrfRetry &&
        err instanceof ApiClientError &&
        err.code &&
        CSRF_RETRY_CODES.has(err.code)
      ) {
        clearCsrfTokenCache();
        return run(false);
      }
      throw err;
    }
  };
  return run(true);
}

export async function getMe(signal?: AbortSignal): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/api/auth/me", { signal });
}

export async function getGuilds(
  signal?: AbortSignal,
): Promise<AuthGuildsResponse> {
  return apiFetch<AuthGuildsResponse>("/api/auth/guilds", { signal });
}

export async function getSoundroomState(
  guildId: string,
  signal?: AbortSignal,
): Promise<AuthSoundroomStateResponse> {
  return apiFetch<AuthSoundroomStateResponse>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom-state`,
    { signal },
  );
}

export async function logout(): Promise<void> {
  try {
    await apiPost<{ ok: true }>("/api/auth/logout", undefined);
  } finally {
    clearCsrfTokenCache();
  }
}

export async function controlSoundroom(
  guildId: string,
  request: SoundroomControlRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomControlResponseDto> {
  return apiPost<SoundroomControlResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/control`,
    request,
    { signal },
  );
}

export async function getSoundroomControlStatus(
  guildId: string,
  signal?: AbortSignal,
): Promise<SoundroomControlStatusResponseDto> {
  return apiFetch<SoundroomControlStatusResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/control-status`,
    { signal },
  );
}

export async function searchSoundroomTracks(
  guildId: string,
  query: string,
  signal?: AbortSignal,
): Promise<SoundroomSearchResponseDto> {
  return apiPost<SoundroomSearchResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/search`,
    { query },
    { signal },
  );
}

export async function addSoundroomTrack(
  guildId: string,
  request: SoundroomAddRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomAddResponseDto> {
  return apiPost<SoundroomAddResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/add`,
    request,
    { signal },
  );
}

export async function addSoundroomPlaylist(
  guildId: string,
  request: SoundroomPlaylistAddRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomPlaylistAddResponseDto> {
  return apiPost<SoundroomPlaylistAddResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/add-playlist`,
    request,
    { signal },
  );
}

export async function removeSoundroomQueueItem(
  guildId: string,
  request: SoundroomQueueRemoveRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomQueueRemoveResponseDto> {
  return apiPost<SoundroomQueueRemoveResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/queue/remove`,
    request,
    { signal },
  );
}

export async function swapSoundroomQueueItems(
  guildId: string,
  request: SoundroomQueueSwapRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomQueueSwapResponseDto> {
  return apiPost<SoundroomQueueSwapResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/queue/swap`,
    request,
    { signal },
  );
}

export async function getMyPlaylists(
  signal?: AbortSignal,
): Promise<WebPlaylistMineResponseDto> {
  return apiFetch<WebPlaylistMineResponseDto>("/api/auth/playlists/mine", {
    signal,
  });
}

export async function getPublicPlaylists(
  params: { q?: string; limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<WebPlaylistPublicListResponseDto> {
  const search = new URLSearchParams();
  if (params.q?.trim()) {
    search.set("q", params.q.trim());
  }
  if (params.limit != null) {
    search.set("limit", String(params.limit));
  }
  if (params.offset != null) {
    search.set("offset", String(params.offset));
  }
  const qs = search.toString();
  return apiFetch<WebPlaylistPublicListResponseDto>(
    `/api/auth/playlists/public${qs ? `?${qs}` : ""}`,
    { signal },
  );
}

export async function getPlaylistDetail(
  playlistId: string,
  signal?: AbortSignal,
): Promise<WebPlaylistDetailResponseDto> {
  return apiFetch<WebPlaylistDetailResponseDto>(
    `/api/auth/playlists/${encodeURIComponent(playlistId)}`,
    { signal },
  );
}

export async function createPlaylist(
  request: WebPlaylistCreateRequestDto,
  signal?: AbortSignal,
): Promise<WebPlaylistCreateResponseDto> {
  return apiPost<WebPlaylistCreateResponseDto>(
    "/api/auth/playlists",
    request,
    { signal },
  );
}

export async function updatePlaylist(
  playlistId: string,
  request: WebPlaylistUpdateRequestDto,
  signal?: AbortSignal,
): Promise<WebPlaylistDetailResponseDto> {
  return apiWriteWithCsrf<WebPlaylistDetailResponseDto>(
    "PATCH",
    `/api/auth/playlists/${encodeURIComponent(playlistId)}`,
    request,
    { signal },
  );
}

export async function deletePlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<WebPlaylistDeleteResponseDto> {
  return apiWriteWithCsrf<WebPlaylistDeleteResponseDto>(
    "DELETE",
    `/api/auth/playlists/${encodeURIComponent(playlistId)}`,
    undefined,
    { signal },
  );
}

export async function addTrackToPlaylist(
  playlistId: string,
  request: WebPlaylistTrackAddRequestDto,
  signal?: AbortSignal,
): Promise<WebPlaylistTrackAddResponseDto> {
  return apiPost<WebPlaylistTrackAddResponseDto>(
    `/api/auth/playlists/${encodeURIComponent(playlistId)}/tracks`,
    request,
    { signal },
  );
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
  signal?: AbortSignal,
): Promise<{ ok: true; removed: true }> {
  return apiWriteWithCsrf<{ ok: true; removed: true }>(
    "DELETE",
    `/api/auth/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
    undefined,
    { signal },
  );
}

export async function reorderPlaylistTracks(
  playlistId: string,
  request: WebPlaylistTrackReorderRequestDto,
  signal?: AbortSignal,
): Promise<WebPlaylistTrackReorderResponseDto> {
  return apiPost<WebPlaylistTrackReorderResponseDto>(
    `/api/auth/playlists/${encodeURIComponent(playlistId)}/tracks/reorder`,
    request,
    { signal },
  );
}

export async function addPlaylistToQueue(
  guildId: string,
  playlistId: string,
  request: WebPlaylistAddToQueueRequestDto,
  signal?: AbortSignal,
): Promise<WebPlaylistAddToQueueResponseDto> {
  return apiPost<WebPlaylistAddToQueueResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/playlists/${encodeURIComponent(playlistId)}/add-to-queue`,
    request,
    { signal },
  );
}

export async function getAdminPublicPlaylists(
  params: {
    q?: string;
    hidden?: WebPlaylistAdminListHiddenFilter;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
): Promise<WebPlaylistAdminListResponseDto> {
  const search = new URLSearchParams();
  if (params.q?.trim()) {
    search.set("q", params.q.trim());
  }
  if (params.hidden) {
    search.set("hidden", params.hidden);
  }
  if (params.limit != null) {
    search.set("limit", String(params.limit));
  }
  if (params.offset != null) {
    search.set("offset", String(params.offset));
  }
  const qs = search.toString();
  return apiFetch<WebPlaylistAdminListResponseDto>(
    `/api/auth/playlists/admin/public${qs ? `?${qs}` : ""}`,
    { signal },
  );
}

export async function setPlaylistAdminHidden(
  playlistId: string,
  hidden: boolean,
  signal?: AbortSignal,
): Promise<WebPlaylistAdminHideResponseDto> {
  const body: WebPlaylistAdminHideRequestDto = { hidden };
  return apiPost<WebPlaylistAdminHideResponseDto>(
    `/api/auth/playlists/${encodeURIComponent(playlistId)}/admin/hide`,
    body,
    { signal },
  );
}
