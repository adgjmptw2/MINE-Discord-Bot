import { randomBytes } from "node:crypto";
import {
  getWebDashboardConfig,
  isWebDashboardOAuthConfigured,
  type WebDashboardConfig,
} from "@/web/config";
import type { DiscordOAuthGuildDto, DiscordOAuthUserDto } from "@/web/types";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map<string, number>();

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface DiscordApiUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

interface DiscordApiGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
}

function config(): WebDashboardConfig {
  return getWebDashboardConfig();
}

export function createOAuthState(): string {
  cleanupExpiredOAuthStates();
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  return state;
}

export function consumeOAuthState(state: string): boolean {
  cleanupExpiredOAuthStates();
  const expiresAt = oauthStates.get(state);
  if (!expiresAt) {
    return false;
  }
  oauthStates.delete(state);
  return expiresAt > Date.now();
}

function cleanupExpiredOAuthStates(): void {
  const now = Date.now();
  for (const [state, expiresAt] of oauthStates) {
    if (expiresAt <= now) {
      oauthStates.delete(state);
    }
  }
}

export function buildDiscordOAuthAuthorizeUrl(state: string): string {
  const cfg = config();
  const clientId = cfg.discordOAuthClientId ?? "";
  const redirectUri = cfg.discordOAuthRedirectUri ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function isOAuthReady(cfg: WebDashboardConfig = config()): boolean {
  return isWebDashboardOAuthConfigured(cfg);
}

function buildAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) {
    return null;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function buildGuildIconUrl(
  guildId: string,
  icon: string | null,
): string | null {
  if (!icon) {
    return null;
  }
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

function mapUser(raw: DiscordApiUser): DiscordOAuthUserDto {
  const avatar = raw.avatar ?? null;
  return {
    id: raw.id,
    username: raw.username,
    globalName: raw.global_name ?? null,
    avatar,
    avatarUrl: buildAvatarUrl(raw.id, avatar),
  };
}

function mapGuild(raw: DiscordApiGuild): DiscordOAuthGuildDto {
  const icon = raw.icon ?? null;
  return {
    id: raw.id,
    name: raw.name,
    icon,
    iconUrl: buildGuildIconUrl(raw.id, icon),
    owner: Boolean(raw.owner),
    permissions: raw.permissions ?? "0",
  };
}

export async function exchangeDiscordOAuthCode(
  code: string,
): Promise<DiscordTokenResponse> {
  const cfg = config();
  const body = new URLSearchParams({
    client_id: cfg.discordOAuthClientId ?? "",
    client_secret: cfg.discordOAuthClientSecret ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.discordOAuthRedirectUri ?? "",
  });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error("DISCORD_TOKEN_EXCHANGE_FAILED");
  }

  return (await res.json()) as DiscordTokenResponse;
}

export async function fetchDiscordCurrentUser(
  accessToken: string,
): Promise<DiscordOAuthUserDto> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("DISCORD_USER_FETCH_FAILED");
  }
  const raw = (await res.json()) as DiscordApiUser;
  return mapUser(raw);
}

export async function fetchDiscordCurrentUserGuilds(
  accessToken: string,
): Promise<DiscordOAuthGuildDto[]> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("DISCORD_GUILDS_FETCH_FAILED");
  }
  const raw = (await res.json()) as DiscordApiGuild[];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(mapGuild);
}
