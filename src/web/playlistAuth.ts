import type { MineClient } from "@/types";
import type { WebPlaylistRecord } from "@/web/playlistDb";
import type { WebSession } from "@/web/session";

export function isWebDashboardBotOwner(
  userId: string,
  client: MineClient,
): boolean {
  return client.config.developers.includes(userId);
}

export function isPlaylistOwner(
  session: WebSession,
  playlist: WebPlaylistRecord,
): boolean {
  return playlist.owner_user_id === session.user.id;
}

export function canViewWebPlaylist(
  session: WebSession,
  playlist: WebPlaylistRecord,
  client: MineClient,
): boolean {
  if (playlist.is_deleted) {
    return false;
  }
  const owner = isPlaylistOwner(session, playlist);
  const botOwner = isWebDashboardBotOwner(session.user.id, client);
  if (owner || botOwner) {
    return true;
  }
  if (playlist.visibility !== "public") {
    return false;
  }
  if (playlist.is_hidden_by_admin) {
    return false;
  }
  return true;
}

export function canManageWebPlaylist(
  session: WebSession,
  playlist: WebPlaylistRecord,
  client: MineClient,
): boolean {
  if (playlist.is_deleted) {
    return false;
  }
  return (
    isPlaylistOwner(session, playlist) ||
    isWebDashboardBotOwner(session.user.id, client)
  );
}

export function canAdminWebPlaylist(
  session: WebSession,
  client: MineClient,
): boolean {
  return isWebDashboardBotOwner(session.user.id, client);
}

export function requirePlaylistAdminAccess(
  session: WebSession,
  client: MineClient,
): { ok: true } | { ok: false; code: "PLAYLIST_ADMIN_REQUIRED" } {
  if (!canAdminWebPlaylist(session, client)) {
    return { ok: false, code: "PLAYLIST_ADMIN_REQUIRED" };
  }
  return { ok: true };
}
