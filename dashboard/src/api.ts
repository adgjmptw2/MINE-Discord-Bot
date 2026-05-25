import type {
  ApiErrorResponse,
  AuthGuildsResponse,
  AuthMeResponse,
  AuthSoundroomStateResponse,
  SoundroomAddRequestDto,
  SoundroomAddResponseDto,
  SoundroomControlRequestDto,
  SoundroomControlResponseDto,
  SoundroomControlStatusResponseDto,
  SoundroomQueueRemoveRequestDto,
  SoundroomQueueRemoveResponseDto,
  SoundroomSearchResponseDto,
} from "./types";

const DEFAULT_API_BASE = "http://127.0.0.1:3077";

const NETWORK_ERROR_MESSAGE =
  "API 서버에 연결할 수 없습니다. 봇이 켜져 있는지, 대시보드 주소가 .env의 WEB_DASHBOARD_ALLOWED_ORIGIN과 같은 호스트(127.0.0.1 vs localhost)인지 확인하세요.";

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

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_WEB_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : DEFAULT_API_BASE;
}

export function getDiscordLoginUrl(): string {
  return `${getApiBaseUrl()}/api/auth/discord/login`;
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
  await apiFetch<{ ok: true }>("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function controlSoundroom(
  guildId: string,
  request: SoundroomControlRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomControlResponseDto> {
  return apiFetch<SoundroomControlResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/control`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
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
  return apiFetch<SoundroomSearchResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/search`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
}

export async function addSoundroomTrack(
  guildId: string,
  request: SoundroomAddRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomAddResponseDto> {
  return apiFetch<SoundroomAddResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/add`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export async function removeSoundroomQueueItem(
  guildId: string,
  request: SoundroomQueueRemoveRequestDto,
  signal?: AbortSignal,
): Promise<SoundroomQueueRemoveResponseDto> {
  return apiFetch<SoundroomQueueRemoveResponseDto>(
    `/api/auth/guilds/${encodeURIComponent(guildId)}/soundroom/queue/remove`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}
