import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import { getSoundroom } from "@/storage/soundroom";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { sendError, sendJson } from "@/web/http";
import { readSessionFromRequest } from "@/web/session";
import type {
  AuthGuildsResponseDto,
  DiscordOAuthGuildDto,
  WebDashboardGuildDto,
} from "@/web/types";

const PERM_ADMINISTRATOR = 0x8n;
const PERM_MANAGE_GUILD = 0x20n;

function permissionFlags(permissions: string): {
  hasManageGuild: boolean;
  hasAdministrator: boolean;
} {
  try {
    const bits = BigInt(permissions);
    return {
      hasManageGuild: (bits & PERM_MANAGE_GUILD) === PERM_MANAGE_GUILD,
      hasAdministrator: (bits & PERM_ADMINISTRATOR) === PERM_ADMINISTRATOR,
    };
  } catch {
    return { hasManageGuild: false, hasAdministrator: false };
  }
}

function toDashboardGuild(
  client: MineClient,
  guild: DiscordOAuthGuildDto,
): WebDashboardGuildDto | null {
  if (!client.guilds.cache.has(guild.id)) {
    return null;
  }

  const soundroom = getSoundroom(guild.id);
  const perms = permissionFlags(guild.permissions);

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    iconUrl: guild.iconUrl,
    owner: guild.owner,
    permissions: guild.permissions,
    botInGuild: true,
    soundroomConfigured: soundroom !== undefined,
    soundroomChannelId: soundroom?.channelId ?? null,
    hasManageGuild: perms.hasManageGuild,
    hasAdministrator: perms.hasAdministrator,
  };
}

export function handleAuthGuilds(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
): void {
  if (!isWebDashboardAuthEnabled()) {
    sendError(
      res,
      503,
      "AUTH_DISABLED",
      "웹 대시보드 로그인이 비활성화되어 있습니다.",
    );
    return;
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return;
  }

  const guilds: WebDashboardGuildDto[] = [];
  for (const g of session.guilds) {
    const dto = toDashboardGuild(client, g);
    if (dto) {
      guilds.push(dto);
    }
  }

  guilds.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const body: AuthGuildsResponseDto = { ok: true, guilds };
  sendJson(res, 200, body);
}
