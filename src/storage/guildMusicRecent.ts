import { db } from "@/storage/db";

export interface GuildRecentPlayRow {
  title: string;
  uri: string;
  author: string;
  played_at: string;
}

const MAX_ROWS_PER_GUILD = 400;

export function recordGuildRecentPlay(guildId: string, title: string, uri: string, author: string): void {
  const playedAt = new Date().toISOString();
  db.run(`INSERT INTO music_guild_recent_play (guild_id, title, uri, author, played_at) VALUES (?, ?, ?, ?, ?)`, [
    guildId,
    title,
    uri,
    author,
    playedAt,
  ]);
  db.run(
    `DELETE FROM music_guild_recent_play
      WHERE guild_id = ?
        AND rowid NOT IN (
          SELECT rowid
            FROM music_guild_recent_play
           WHERE guild_id = ?
           ORDER BY played_at DESC
           LIMIT ?
        )`,
    [guildId, guildId, MAX_ROWS_PER_GUILD],
  );
}

export function listGuildRecentPlays(guildId: string, limit = 20): GuildRecentPlayRow[] {
  return db.all<GuildRecentPlayRow>(
    `SELECT title, uri, author, played_at FROM music_guild_recent_play WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?`,
    [guildId, limit],
  );
}
