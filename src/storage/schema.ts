import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const playlists = sqliteTable(
  "playlists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    nameKey: text("name_key").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    ownerNameUnique: uniqueIndex("playlists_owner_name_unique").on(table.ownerId, table.nameKey),
  }),
);

export const playlistTracks = sqliteTable(
  "playlist_tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistId: integer("playlist_id").notNull(),
    title: text("title").notNull(),
    uri: text("uri").notNull(),
    author: text("author").notNull(),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => ({
    playlistOrder: index("idx_playlist_tracks_playlist_order").on(table.playlistId, table.orderIndex),
  }),
);

export const soundroom = sqliteTable("soundroom", {
  guildId: text("guild_id").primaryKey(),
  channelId: text("channel_id").notNull(),
  panelMessageId: text("panel_message_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const guildRecentPlays = sqliteTable(
  "music_guild_recent_play",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    title: text("title").notNull(),
    uri: text("uri").notNull(),
    author: text("author").notNull().default(""),
    playedAt: text("played_at").notNull(),
  },
  (table) => ({
    guildPlayedAt: index("idx_music_guild_recent_guild_time").on(table.guildId, table.playedAt),
    guildIdDesc: index("idx_music_guild_recent_guild_id").on(table.guildId, table.id),
  }),
);

/** 전역 인기차트는 `guild_id`에 `__bot_global_melon__`를 넣은 한 줄만 사용합니다. */
export const soundroomChartSource = sqliteTable("soundroom_chart_source", {
  guildId: text("guild_id").primaryKey(),
  playlistUrl: text("playlist_url").notNull(),
  priorityVideoId: text("priority_video_id"),
  updatedAt: text("updated_at").notNull(),
});
