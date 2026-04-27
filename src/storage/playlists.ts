import { db } from "@/storage/db";

interface PlaylistEntry {
  title: string;
  uri: string;
  author: string;
}

interface PlaylistRecord {
  ownerId: string;
  createdAt: string;
  tracks: PlaylistEntry[];
}

function key(name: string): string {
  return name.trim().toLowerCase();
}

interface PlaylistRow {
  id: number;
  owner_id: string;
  created_at: string;
}

function getPlaylistRow(ownerId: string, name: string): PlaylistRow | undefined {
  const nameKey = key(name);
  return db.get<PlaylistRow>(
    `
      SELECT id, owner_id, created_at
      FROM playlists
      WHERE owner_id = ? AND name_key = ?
    `,
    [ownerId, nameKey],
  );
}

function getPlaylistTracks(playlistId: number): PlaylistEntry[] {
  return db.all<PlaylistEntry>(
    `
      SELECT title, uri, author
      FROM playlist_tracks
      WHERE playlist_id = ?
      ORDER BY order_index ASC
    `,
    [playlistId],
  );
}

export function createPlaylist(ownerId: string, name: string): PlaylistRecord {
  const nameKey = key(name);
  const exists = getPlaylistRow(ownerId, name);

  if (exists) {
    throw new Error("A playlist with that name already exists.");
  }

  const createdAt = new Date().toISOString();
  db.run(
    `
      INSERT INTO playlists (owner_id, name_key, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `,
    [ownerId, nameKey, name.trim(), createdAt],
  );

  return { ownerId, createdAt, tracks: [] };
}

export function getPlaylist(ownerId: string, name: string): PlaylistRecord | undefined {
  const row = getPlaylistRow(ownerId, name);
  if (!row) {
    return undefined;
  }

  return {
    ownerId: row.owner_id,
    createdAt: row.created_at,
    tracks: getPlaylistTracks(row.id),
  };
}

export function listPlaylists(ownerId: string): string[] {
  return db
    .all<{ display_name: string }>(
      `
        SELECT display_name
        FROM playlists
        WHERE owner_id = ?
        ORDER BY display_name ASC
      `,
      [ownerId],
    )
    .map((row) => row.display_name);
}

export function addTrackToPlaylist(ownerId: string, name: string, track: PlaylistEntry): PlaylistRecord {
  const row = getPlaylistRow(ownerId, name);

  if (!row) {
    throw new Error("Playlist not found.");
  }

  const maxOrder = db.get<{ value: number | null }>(
    "SELECT MAX(order_index) AS value FROM playlist_tracks WHERE playlist_id = ?",
    [row.id],
  )?.value;
  const nextOrder = typeof maxOrder === "number" ? maxOrder + 1 : 0;

  db.run(
    `
      INSERT INTO playlist_tracks (playlist_id, title, uri, author, order_index)
      VALUES (?, ?, ?, ?, ?)
    `,
    [row.id, track.title, track.uri, track.author, nextOrder],
  );

  return {
    ownerId: row.owner_id,
    createdAt: row.created_at,
    tracks: getPlaylistTracks(row.id),
  };
}

export function removeTrackFromPlaylist(ownerId: string, name: string, position: number): PlaylistRecord {
  const row = getPlaylistRow(ownerId, name);

  if (!row) {
    throw new Error("Playlist not found.");
  }

  const tracks = db.all<{ id: number; order_index: number }>(
    `
      SELECT id, order_index
      FROM playlist_tracks
      WHERE playlist_id = ?
      ORDER BY order_index ASC
    `,
    [row.id],
  );

  if (position < 1 || position > tracks.length) {
    throw new Error("Track position is out of range.");
  }

  const target = tracks[position - 1];
  db.run("DELETE FROM playlist_tracks WHERE id = ?", [target.id]);
  db.run(
    `
      UPDATE playlist_tracks
      SET order_index = order_index - 1
      WHERE playlist_id = ? AND order_index > ?
    `,
    [row.id, target.order_index],
  );

  return {
    ownerId: row.owner_id,
    createdAt: row.created_at,
    tracks: getPlaylistTracks(row.id),
  };
}

export function deletePlaylist(ownerId: string, name: string): void {
  const row = getPlaylistRow(ownerId, name);

  if (!row) {
    throw new Error("Playlist not found.");
  }

  db.run("DELETE FROM playlist_tracks WHERE playlist_id = ?", [row.id]);
  db.run("DELETE FROM playlists WHERE id = ?", [row.id]);
}
