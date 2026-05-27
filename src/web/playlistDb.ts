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
  ensureWebPlaylistReportTable();
  ensureWebPlaylistFavoriteTable();
  tablesReady = true;
}

let favoriteTablesReady = false;

function ensureWebPlaylistFavoriteTable(): void {
  if (favoriteTablesReady) {
    return;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_playlist_favorites (
      playlist_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (playlist_id, user_id),
      FOREIGN KEY (playlist_id) REFERENCES web_playlists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_web_playlist_favorites_user_created_at
      ON web_playlist_favorites(user_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_web_playlist_favorites_playlist_id
      ON web_playlist_favorites(playlist_id);
  `);
  favoriteTablesReady = true;
}

export type WebPlaylistReportReason =
  | "inappropriate"
  | "spam"
  | "misleading"
  | "broken"
  | "other";

export type WebPlaylistReportStatus = "open" | "resolved";

export type WebPlaylistReportRecord = {
  id: string;
  playlist_id: string;
  reporter_user_id: string;
  reporter_name_snapshot: string;
  reason: WebPlaylistReportReason;
  detail: string;
  status: WebPlaylistReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution_note: string;
};

export type AdminPlaylistReportRow = WebPlaylistReportRecord & {
  playlist_title: string | null;
  playlist_owner_name_snapshot: string | null;
  playlist_is_deleted: number | null;
  playlist_is_hidden_by_admin: number | null;
};

let reportTablesReady = false;

function ensureWebPlaylistReportTable(): void {
  if (reportTablesReady) {
    return;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_playlist_reports (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      reporter_user_id TEXT NOT NULL,
      reporter_name_snapshot TEXT NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT NULL,
      resolved_by_user_id TEXT NULL,
      resolution_note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (playlist_id) REFERENCES web_playlists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_web_playlist_reports_playlist_id
      ON web_playlist_reports(playlist_id);

    CREATE INDEX IF NOT EXISTS idx_web_playlist_reports_status_created_at
      ON web_playlist_reports(status, created_at);

    CREATE INDEX IF NOT EXISTS idx_web_playlist_reports_reporter
      ON web_playlist_reports(reporter_user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_web_playlist_reports_playlist_reporter
      ON web_playlist_reports(playlist_id, reporter_user_id);
  `);
  reportTablesReady = true;
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

function mapReportRow(row: WebPlaylistReportRecord): WebPlaylistReportRecord {
  return {
    id: row.id,
    playlist_id: row.playlist_id,
    reporter_user_id: row.reporter_user_id,
    reporter_name_snapshot: row.reporter_name_snapshot,
    reason: row.reason as WebPlaylistReportReason,
    detail: row.detail,
    status: row.status as WebPlaylistReportStatus,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    resolved_by_user_id: row.resolved_by_user_id,
    resolution_note: row.resolution_note,
  };
}

export function getPlaylistReportByPlaylistAndReporter(
  playlistId: string,
  reporterUserId: string,
): WebPlaylistReportRecord | null {
  ensureWebPlaylistReportTable();
  const row = db.get<WebPlaylistReportRecord>(
    `SELECT id, playlist_id, reporter_user_id, reporter_name_snapshot, reason, detail,
            status, created_at, resolved_at, resolved_by_user_id, resolution_note
     FROM web_playlist_reports
     WHERE playlist_id = ? AND reporter_user_id = ?`,
    [playlistId, reporterUserId],
  );
  return row ? mapReportRow(row) : null;
}

export function getPlaylistReportById(
  reportId: string,
): WebPlaylistReportRecord | null {
  ensureWebPlaylistReportTable();
  const row = db.get<WebPlaylistReportRecord>(
    `SELECT id, playlist_id, reporter_user_id, reporter_name_snapshot, reason, detail,
            status, created_at, resolved_at, resolved_by_user_id, resolution_note
     FROM web_playlist_reports WHERE id = ?`,
    [reportId],
  );
  return row ? mapReportRow(row) : null;
}

export function createPlaylistReport(input: {
  playlistId: string;
  reporterUserId: string;
  reporterNameSnapshot: string;
  reason: WebPlaylistReportReason;
  detail: string;
}): WebPlaylistReportRecord {
  ensureWebPlaylistReportTable();
  const existing = getPlaylistReportByPlaylistAndReporter(
    input.playlistId,
    input.reporterUserId,
  );
  if (existing) {
    throw new Error("PLAYLIST_REPORT_DUPLICATE");
  }
  const id = randomUUID();
  const ts = nowIso();
  try {
    db.run(
      `INSERT INTO web_playlist_reports (
        id, playlist_id, reporter_user_id, reporter_name_snapshot,
        reason, detail, status, created_at, resolved_at, resolved_by_user_id, resolution_note
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, NULL, '')`,
      [
        id,
        input.playlistId,
        input.reporterUserId,
        input.reporterNameSnapshot,
        input.reason,
        input.detail,
        ts,
      ],
    );
  } catch {
    throw new Error("PLAYLIST_REPORT_DUPLICATE");
  }
  const created = getPlaylistReportById(id);
  if (!created) {
    throw new Error("PLAYLIST_REPORT_CREATE_FAILED");
  }
  return created;
}

export type WebPlaylistAdminReportStatusFilter = "open" | "resolved" | "all";

export function listAdminPlaylistReports(params: {
  status: WebPlaylistAdminReportStatusFilter;
  q?: string;
  limit: number;
  offset: number;
}): AdminPlaylistReportRow[] {
  ensureWebPlaylistReportTable();
  const statusClause =
    params.status === "open"
      ? " AND r.status = 'open'"
      : params.status === "resolved"
        ? " AND r.status = 'resolved'"
        : "";
  const q = params.q?.trim();
  const baseFrom = `FROM web_playlist_reports r
     LEFT JOIN web_playlists p ON p.id = r.playlist_id
     WHERE 1=1${statusClause}`;
  const orderLimit = ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;

  if (q) {
    const like = `%${q.replace(/%/g, "").replace(/_/g, "")}%`;
    const rows = db.all<AdminPlaylistReportRow>(
      `SELECT r.id, r.playlist_id, r.reporter_user_id, r.reporter_name_snapshot,
              r.reason, r.detail, r.status, r.created_at, r.resolved_at,
              r.resolved_by_user_id, r.resolution_note,
              p.title AS playlist_title,
              p.owner_name_snapshot AS playlist_owner_name_snapshot,
              p.is_deleted AS playlist_is_deleted,
              p.is_hidden_by_admin AS playlist_is_hidden_by_admin
       ${baseFrom}
         AND (
           r.detail LIKE ? OR r.reporter_name_snapshot LIKE ?
           OR p.title LIKE ? OR p.owner_name_snapshot LIKE ?
         )
       ${orderLimit}`,
      [like, like, like, like, params.limit, params.offset],
    );
    return rows.map((row) => ({
      ...mapReportRow(row),
      playlist_title: row.playlist_title,
      playlist_owner_name_snapshot: row.playlist_owner_name_snapshot,
      playlist_is_deleted: row.playlist_is_deleted,
      playlist_is_hidden_by_admin: row.playlist_is_hidden_by_admin,
    }));
  }

  const rows = db.all<AdminPlaylistReportRow>(
    `SELECT r.id, r.playlist_id, r.reporter_user_id, r.reporter_name_snapshot,
            r.reason, r.detail, r.status, r.created_at, r.resolved_at,
            r.resolved_by_user_id, r.resolution_note,
            p.title AS playlist_title,
            p.owner_name_snapshot AS playlist_owner_name_snapshot,
            p.is_deleted AS playlist_is_deleted,
            p.is_hidden_by_admin AS playlist_is_hidden_by_admin
     ${baseFrom}${orderLimit}`,
    [params.limit, params.offset],
  );
  return rows.map((row) => ({
    ...mapReportRow(row),
    playlist_title: row.playlist_title,
    playlist_owner_name_snapshot: row.playlist_owner_name_snapshot,
    playlist_is_deleted: row.playlist_is_deleted,
    playlist_is_hidden_by_admin: row.playlist_is_hidden_by_admin,
  }));
}

export function addWebPlaylistFavorite(
  playlistId: string,
  userId: string,
): void {
  ensureWebPlaylistFavoriteTable();
  db.run(
    `INSERT OR IGNORE INTO web_playlist_favorites (playlist_id, user_id, created_at)
     VALUES (?, ?, ?)`,
    [playlistId, userId, nowIso()],
  );
}

export function removeWebPlaylistFavorite(
  playlistId: string,
  userId: string,
): void {
  ensureWebPlaylistFavoriteTable();
  db.run(
    `DELETE FROM web_playlist_favorites WHERE playlist_id = ? AND user_id = ?`,
    [playlistId, userId],
  );
}

export function isWebPlaylistFavoritedByUser(
  playlistId: string,
  userId: string,
): boolean {
  ensureWebPlaylistFavoriteTable();
  const row = db.get<{ c: number }>(
    `SELECT 1 AS c FROM web_playlist_favorites
     WHERE playlist_id = ? AND user_id = ?`,
    [playlistId, userId],
  );
  return (row?.c ?? 0) > 0;
}

export function listFavoritePlaylistIds(
  userId: string,
  playlistIds: string[],
): Set<string> {
  ensureWebPlaylistFavoriteTable();
  if (playlistIds.length === 0) {
    return new Set();
  }
  const placeholders = playlistIds.map(() => "?").join(", ");
  const rows = db.all<{ playlist_id: string }>(
    `SELECT playlist_id FROM web_playlist_favorites
     WHERE user_id = ? AND playlist_id IN (${placeholders})`,
    [userId, ...playlistIds],
  );
  return new Set(rows.map((r) => r.playlist_id));
}

export type WebPlaylistFavoriteListRow = WebPlaylistRecord & {
  track_count: number;
  favorited_at: string;
};

/** 즐겨찾기 목록은 숨김·삭제·비공개 플레이리스트를 제외한다(개인 북마크용). */
export function listFavoriteWebPlaylists(
  userId: string,
  params: { limit: number; offset: number },
): WebPlaylistFavoriteListRow[] {
  ensureWebPlaylistFavoriteTable();
  const rows = db.all<PlaylistRow & { favorited_at: string }>(
    `SELECT p.id, p.owner_user_id, p.owner_name_snapshot, p.title, p.description,
            p.visibility, p.is_deleted, p.is_hidden_by_admin, p.created_at, p.updated_at, p.deleted_at,
            COUNT(t.id) AS track_count, f.created_at AS favorited_at
     FROM web_playlist_favorites f
     INNER JOIN web_playlists p ON p.id = f.playlist_id
     LEFT JOIN web_playlist_tracks t ON t.playlist_id = p.id
     WHERE f.user_id = ?
       AND p.visibility = 'public'
       AND p.is_deleted = 0
       AND p.is_hidden_by_admin = 0
     GROUP BY p.id, f.created_at
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, params.limit, params.offset],
  );
  return rows.map((row) => ({
    ...mapPlaylistRow(row),
    track_count: Number(row.track_count ?? 0),
    favorited_at: row.favorited_at,
  }));
}

export function resolvePlaylistReportRecord(
  reportId: string,
  resolverUserId: string,
  resolutionNote: string,
): WebPlaylistReportRecord | null {
  ensureWebPlaylistReportTable();
  const current = getPlaylistReportById(reportId);
  if (!current || current.status === "resolved") {
    return null;
  }
  const ts = nowIso();
  db.run(
    `UPDATE web_playlist_reports
     SET status = 'resolved', resolved_at = ?, resolved_by_user_id = ?, resolution_note = ?
     WHERE id = ? AND status = 'open'`,
    [ts, resolverUserId, resolutionNote, reportId],
  );
  return getPlaylistReportById(reportId);
}
