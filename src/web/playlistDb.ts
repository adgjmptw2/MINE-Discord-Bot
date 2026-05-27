import { randomUUID } from "node:crypto";
import { db } from "@/storage/db";

export type WebPlaylistVisibility = "private" | "public";

export type WebPlaylistRecord = {
  id: string;
  owner_user_id: string;
  owner_name_snapshot: string;
  title: string;
  description: string;
  visibility: WebPlaylistVisibility;
  is_deleted: number;
  is_hidden_by_admin: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WebPlaylistTrackRecord = {
  id: string;
  playlist_id: string;
  position: number;
  title: string;
  uri: string;
  author: string;
  duration_ms: number;
  thumbnail_url: string | null;
  source: string;
  created_at: string;
};

export const MAX_WEB_PLAYLISTS_PER_USER = 20;
export const MAX_WEB_PUBLIC_PLAYLISTS_PER_USER = 5;
export const MAX_WEB_PLAYLIST_TRACKS = 50;

let tablesReady = false;

export function ensureWebPlaylistTables(): void {
  if (tablesReady) {
    return;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_playlists (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      owner_name_snapshot TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      is_hidden_by_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_web_playlists_owner_user_id
      ON web_playlists(owner_user_id);

    CREATE INDEX IF NOT EXISTS idx_web_playlists_visibility
      ON web_playlists(visibility);

    CREATE INDEX IF NOT EXISTS idx_web_playlists_public_visible
      ON web_playlists(visibility, is_deleted, is_hidden_by_admin, updated_at);

    CREATE TABLE IF NOT EXISTS web_playlist_tracks (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      uri TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      thumbnail_url TEXT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES web_playlists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_web_playlist_tracks_playlist_id_position
      ON web_playlist_tracks(playlist_id, position);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_web_playlist_tracks_playlist_position
      ON web_playlist_tracks(playlist_id, position);
  `);
  tablesReady = true;
}

function nowIso(): string {
  return new Date().toISOString();
}

type PlaylistRow = WebPlaylistRecord & { track_count?: number };

function mapPlaylistRow(row: PlaylistRow): WebPlaylistRecord {
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    owner_name_snapshot: row.owner_name_snapshot,
    title: row.title,
    description: row.description,
    visibility: row.visibility as WebPlaylistVisibility,
    is_deleted: row.is_deleted,
    is_hidden_by_admin: row.is_hidden_by_admin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export function getWebPlaylistById(
  playlistId: string,
): WebPlaylistRecord | null {
  ensureWebPlaylistTables();
  const row = db.get<PlaylistRow>(
    `SELECT id, owner_user_id, owner_name_snapshot, title, description,
            visibility, is_deleted, is_hidden_by_admin, created_at, updated_at, deleted_at
     FROM web_playlists WHERE id = ?`,
    [playlistId],
  );
  return row ? mapPlaylistRow(row) : null;
}

export function countUserWebPlaylists(ownerUserId: string): number {
  ensureWebPlaylistTables();
  const row = db.get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM web_playlists
     WHERE owner_user_id = ? AND is_deleted = 0`,
    [ownerUserId],
  );
  return row?.c ?? 0;
}

export function countUserPublicWebPlaylists(
  ownerUserId: string,
  excludePlaylistId?: string,
): number {
  ensureWebPlaylistTables();
  if (excludePlaylistId) {
    const row = db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM web_playlists
       WHERE owner_user_id = ? AND visibility = 'public' AND is_deleted = 0
         AND id != ?`,
      [ownerUserId, excludePlaylistId],
    );
    return row?.c ?? 0;
  }
  const row = db.get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM web_playlists
     WHERE owner_user_id = ? AND visibility = 'public' AND is_deleted = 0`,
    [ownerUserId],
  );
  return row?.c ?? 0;
}

export function countWebPlaylistTracks(playlistId: string): number {
  ensureWebPlaylistTables();
  const row = db.get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM web_playlist_tracks WHERE playlist_id = ?`,
    [playlistId],
  );
  return row?.c ?? 0;
}

export function listMyWebPlaylists(ownerUserId: string): Array<
  WebPlaylistRecord & { track_count: number }
> {
  ensureWebPlaylistTables();
  const rows = db.all<PlaylistRow>(
    `SELECT p.id, p.owner_user_id, p.owner_name_snapshot, p.title, p.description,
            p.visibility, p.is_deleted, p.is_hidden_by_admin, p.created_at, p.updated_at, p.deleted_at,
            COUNT(t.id) AS track_count
     FROM web_playlists p
     LEFT JOIN web_playlist_tracks t ON t.playlist_id = p.id
     WHERE p.owner_user_id = ? AND p.is_deleted = 0
     GROUP BY p.id
     ORDER BY p.updated_at DESC`,
    [ownerUserId],
  );
  return rows.map((row) => ({
    ...mapPlaylistRow(row),
    track_count: Number(row.track_count ?? 0),
  }));
}

export type WebPlaylistAdminHiddenFilter = "all" | "visible" | "hidden";

export function listAdminPublicWebPlaylists(params: {
  q?: string;
  hidden: WebPlaylistAdminHiddenFilter;
  limit: number;
  offset: number;
}): Array<WebPlaylistRecord & { track_count: number }> {
  ensureWebPlaylistTables();
  const hiddenClause =
    params.hidden === "visible"
      ? " AND p.is_hidden_by_admin = 0"
      : params.hidden === "hidden"
        ? " AND p.is_hidden_by_admin = 1"
        : "";
  const q = params.q?.trim();
  const baseSelect = `SELECT p.id, p.owner_user_id, p.owner_name_snapshot, p.title, p.description,
            p.visibility, p.is_deleted, p.is_hidden_by_admin, p.created_at, p.updated_at, p.deleted_at,
            COUNT(t.id) AS track_count
     FROM web_playlists p
     LEFT JOIN web_playlist_tracks t ON t.playlist_id = p.id
     WHERE p.visibility = 'public' AND p.is_deleted = 0${hiddenClause}`;
  const groupOrder = ` GROUP BY p.id ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`;

  if (q) {
    const like = `%${q.replace(/%/g, "").replace(/_/g, "")}%`;
    const rows = db.all<PlaylistRow>(
      `${baseSelect}
         AND (p.title LIKE ? OR p.description LIKE ? OR p.owner_name_snapshot LIKE ?)
       ${groupOrder}`,
      [like, like, like, params.limit, params.offset],
    );
    return rows.map((row) => ({
      ...mapPlaylistRow(row),
      track_count: Number(row.track_count ?? 0),
    }));
  }

  const rows = db.all<PlaylistRow>(`${baseSelect}${groupOrder}`, [
    params.limit,
    params.offset,
  ]);
  return rows.map((row) => ({
    ...mapPlaylistRow(row),
    track_count: Number(row.track_count ?? 0),
  }));
}

export function listPublicWebPlaylists(params: {
  q?: string;
  limit: number;
  offset: number;
}): Array<WebPlaylistRecord & { track_count: number }> {
  ensureWebPlaylistTables();
  const q = params.q?.trim();
  if (q) {
    const like = `%${q.replace(/%/g, "").replace(/_/g, "")}%`;
    const rows = db.all<PlaylistRow>(
      `SELECT p.id, p.owner_user_id, p.owner_name_snapshot, p.title, p.description,
              p.visibility, p.is_deleted, p.is_hidden_by_admin, p.created_at, p.updated_at, p.deleted_at,
              COUNT(t.id) AS track_count
       FROM web_playlists p
       LEFT JOIN web_playlist_tracks t ON t.playlist_id = p.id
       WHERE p.visibility = 'public' AND p.is_deleted = 0 AND p.is_hidden_by_admin = 0
         AND (p.title LIKE ? OR p.description LIKE ?)
       GROUP BY p.id
       ORDER BY p.updated_at DESC
       LIMIT ? OFFSET ?`,
      [like, like, params.limit, params.offset],
    );
    return rows.map((row) => ({
      ...mapPlaylistRow(row),
      track_count: Number(row.track_count ?? 0),
    }));
  }

  const rows = db.all<PlaylistRow>(
    `SELECT p.id, p.owner_user_id, p.owner_name_snapshot, p.title, p.description,
            p.visibility, p.is_deleted, p.is_hidden_by_admin, p.created_at, p.updated_at, p.deleted_at,
            COUNT(t.id) AS track_count
     FROM web_playlists p
     LEFT JOIN web_playlist_tracks t ON t.playlist_id = p.id
     WHERE p.visibility = 'public' AND p.is_deleted = 0 AND p.is_hidden_by_admin = 0
     GROUP BY p.id
     ORDER BY p.updated_at DESC
     LIMIT ? OFFSET ?`,
    [params.limit, params.offset],
  );
  return rows.map((row) => ({
    ...mapPlaylistRow(row),
    track_count: Number(row.track_count ?? 0),
  }));
}

export function createWebPlaylist(input: {
  ownerUserId: string;
  ownerNameSnapshot: string;
  title: string;
  description: string;
  visibility: WebPlaylistVisibility;
}): WebPlaylistRecord {
  ensureWebPlaylistTables();
  const id = randomUUID();
  const ts = nowIso();
  db.run(
    `INSERT INTO web_playlists (
      id, owner_user_id, owner_name_snapshot, title, description, visibility,
      is_deleted, is_hidden_by_admin, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)`,
    [
      id,
      input.ownerUserId,
      input.ownerNameSnapshot,
      input.title,
      input.description,
      input.visibility,
      ts,
      ts,
    ],
  );
  const created = getWebPlaylistById(id);
  if (!created) {
    throw new Error("PLAYLIST_CREATE_FAILED");
  }
  return created;
}

export function updateWebPlaylist(
  playlistId: string,
  patch: {
    title?: string;
    description?: string;
    visibility?: WebPlaylistVisibility;
  },
): WebPlaylistRecord | null {
  ensureWebPlaylistTables();
  const current = getWebPlaylistById(playlistId);
  if (!current || current.is_deleted) {
    return null;
  }
  const title = patch.title ?? current.title;
  const description = patch.description ?? current.description;
  const visibility = patch.visibility ?? current.visibility;
  const updatedAt = nowIso();
  db.run(
    `UPDATE web_playlists
     SET title = ?, description = ?, visibility = ?, updated_at = ?
     WHERE id = ? AND is_deleted = 0`,
    [title, description, visibility, updatedAt, playlistId],
  );
  return getWebPlaylistById(playlistId);
}

export function softDeleteWebPlaylist(playlistId: string): boolean {
  ensureWebPlaylistTables();
  const ts = nowIso();
  db.run(
    `UPDATE web_playlists
     SET is_deleted = 1, deleted_at = ?, updated_at = ?
     WHERE id = ? AND is_deleted = 0`,
    [ts, ts, playlistId],
  );
  return getWebPlaylistById(playlistId)?.is_deleted === 1;
}

export function setWebPlaylistHiddenByAdmin(
  playlistId: string,
  hidden: boolean,
): WebPlaylistRecord | null {
  ensureWebPlaylistTables();
  const flag = hidden ? 1 : 0;
  const updatedAt = nowIso();
  db.run(
    `UPDATE web_playlists
     SET is_hidden_by_admin = ?, updated_at = ?
     WHERE id = ? AND is_deleted = 0`,
    [flag, updatedAt, playlistId],
  );
  return getWebPlaylistById(playlistId);
}

export function getWebPlaylistTracks(
  playlistId: string,
): WebPlaylistTrackRecord[] {
  ensureWebPlaylistTables();
  return db.all<WebPlaylistTrackRecord>(
    `SELECT id, playlist_id, position, title, uri, author, duration_ms, thumbnail_url, source, created_at
     FROM web_playlist_tracks
     WHERE playlist_id = ?
     ORDER BY position ASC`,
    [playlistId],
  );
}

export function getWebPlaylistTrackById(
  playlistId: string,
  trackId: string,
): WebPlaylistTrackRecord | null {
  ensureWebPlaylistTables();
  return (
    db.get<WebPlaylistTrackRecord>(
      `SELECT id, playlist_id, position, title, uri, author, duration_ms, thumbnail_url, source, created_at
       FROM web_playlist_tracks WHERE playlist_id = ? AND id = ?`,
      [playlistId, trackId],
    ) ?? null
  );
}

export function addWebPlaylistTrack(
  playlistId: string,
  track: {
    title: string;
    uri: string;
    author: string;
    durationMs: number;
    thumbnailUrl: string | null;
    source: string;
  },
): WebPlaylistTrackRecord {
  ensureWebPlaylistTables();
  const position = countWebPlaylistTracks(playlistId);
  const id = randomUUID();
  const ts = nowIso();
  db.run(
    `INSERT INTO web_playlist_tracks (
      id, playlist_id, position, title, uri, author, duration_ms, thumbnail_url, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      playlistId,
      position,
      track.title,
      track.uri,
      track.author,
      track.durationMs,
      track.thumbnailUrl,
      track.source,
      ts,
    ],
  );
  db.run(`UPDATE web_playlists SET updated_at = ? WHERE id = ?`, [ts, playlistId]);
  const row = getWebPlaylistTrackById(playlistId, id);
  if (!row) {
    throw new Error("PLAYLIST_TRACK_CREATE_FAILED");
  }
  return row;
}

export function removeWebPlaylistTrack(
  playlistId: string,
  trackId: string,
): boolean {
  ensureWebPlaylistTables();
  const existing = getWebPlaylistTrackById(playlistId, trackId);
  if (!existing) {
    return false;
  }
  db.run(`DELETE FROM web_playlist_tracks WHERE playlist_id = ? AND id = ?`, [
    playlistId,
    trackId,
  ]);
  renumberWebPlaylistTrackPositions(playlistId);
  db.run(`UPDATE web_playlists SET updated_at = ? WHERE id = ?`, [
    nowIso(),
    playlistId,
  ]);
  return true;
}

function renumberWebPlaylistTrackPositions(playlistId: string): void {
  const tracks = getWebPlaylistTracks(playlistId);
  db.exec("BEGIN");
  try {
    for (let i = 0; i < tracks.length; i += 1) {
      db.run(
        `UPDATE web_playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?`,
        [i, tracks[i]!.id, playlistId],
      );
    }
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
    throw new Error("PLAYLIST_POSITION_RENUMBER_FAILED");
  }
}

export function reorderWebPlaylistTracks(
  playlistId: string,
  trackIds: string[],
): WebPlaylistTrackRecord[] {
  ensureWebPlaylistTables();
  const current = getWebPlaylistTracks(playlistId);
  if (current.length !== trackIds.length) {
    throw new Error("INVALID_PLAYLIST_TRACK_ORDER");
  }
  const currentIds = new Set(current.map((t) => t.id));
  const seen = new Set<string>();
  for (const id of trackIds) {
    if (!currentIds.has(id) || seen.has(id)) {
      throw new Error("INVALID_PLAYLIST_TRACK_ORDER");
    }
    seen.add(id);
  }

  db.exec("BEGIN");
  try {
    for (let i = 0; i < trackIds.length; i += 1) {
      db.run(
        `UPDATE web_playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?`,
        [i, trackIds[i]!, playlistId],
      );
    }
    db.run(`UPDATE web_playlists SET updated_at = ? WHERE id = ?`, [
      nowIso(),
      playlistId,
    ]);
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
    throw new Error("INVALID_PLAYLIST_TRACK_ORDER");
  }
  return getWebPlaylistTracks(playlistId);
}
