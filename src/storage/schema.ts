import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
    ownerNameUnique: uniqueIndex("playlists_owner_name_unique").on(
      table.ownerId,
      table.nameKey,
    ),
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
    playlistOrder: index("idx_playlist_tracks_playlist_order").on(
      table.playlistId,
      table.orderIndex,
    ),
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
    guildPlayedAt: index("idx_music_guild_recent_guild_time").on(
      table.guildId,
      table.playedAt,
    ),
    guildIdDesc: index("idx_music_guild_recent_guild_id").on(
      table.guildId,
      table.id,
    ),
  }),
);

/** 전역 인기차트는 `guild_id`에 `__bot_global_melon__`를 넣은 한 줄만 사용합니다. */
export const soundroomChartSource = sqliteTable("soundroom_chart_source", {
  guildId: text("guild_id").primaryKey(),
  playlistUrl: text("playlist_url").notNull(),
  priorityVideoId: text("priority_video_id"),
  updatedAt: text("updated_at").notNull(),
});

export const stockWallets = sqliteTable(
  "stock_wallets",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    cashBalance: integer("cash_balance").notNull().default(0),
    totalDeposit: integer("total_deposit").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId] }),
  }),
);

export const stockHoldings = sqliteTable(
  "stock_holdings",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    symbol: text("symbol").notNull(),
    quantityMicro: integer("quantity_micro").notNull().default(0),
    averageBuyPrice: integer("average_buy_price").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId, table.symbol] }),
    guildUser: index("idx_stock_holdings_guild_user").on(
      table.guildId,
      table.userId,
    ),
    symbolIdx: index("idx_stock_holdings_symbol").on(table.symbol),
  }),
);

/** side는 DB에서 CHECK(BUY|SELL). Drizzle 스키마에는 제약 미표현(원시 DDL에만 둠). */
export const stockTrades = sqliteTable(
  "stock_trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    quantityMicro: integer("quantity_micro").notNull(),
    price: integer("price").notNull(),
    grossAmount: integer("gross_amount").notNull(),
    fee: integer("fee").notNull(),
    netAmount: integer("net_amount").notNull(),
    realizedProfit: integer("realized_profit"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    guildUserTime: index("idx_stock_trades_guild_user_time").on(
      table.guildId,
      table.userId,
      table.createdAt,
    ),
    guildTime: index("idx_stock_trades_guild_time").on(
      table.guildId,
      table.createdAt,
    ),
    symbolTime: index("idx_stock_trades_symbol_time").on(
      table.symbol,
      table.createdAt,
    ),
  }),
);

export const stockDailyAttendance = sqliteTable(
  "stock_daily_attendance",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId, table.date] }),
    guildDate: index("idx_stock_daily_attendance_guild_date").on(
      table.guildId,
      table.date,
    ),
  }),
);

/** 모의투자 시즌 — ACTIVE는 길드당 하나(unique partial index는 db.ts DDL 참고). */
export const stockSeasons = sqliteTable("stock_seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  createdAt: text("created_at").notNull(),
});

export const stockSeasonResults = sqliteTable(
  "stock_season_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seasonId: integer("season_id").notNull(),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    rank: integer("rank").notNull(),
    totalAssets: integer("total_assets").notNull(),
    cashBalance: integer("cash_balance").notNull(),
    stockValueTotal: integer("stock_value_total").notNull(),
    profitLoss: integer("profit_loss").notNull(),
    profitLossPercent: real("profit_loss_percent").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    seasonRank: index("idx_stock_season_results_season_rank").on(
      table.seasonId,
      table.rank,
    ),
    guildTime: index("idx_stock_season_results_guild_time").on(
      table.guildId,
      table.createdAt,
    ),
  }),
);

export const coinGuildSettings = sqliteTable("coin_guild_settings", {
  guildId: text("guild_id").primaryKey(),
  attendanceReward: integer("attendance_reward").notNull().default(10_000),
  rpsMinBet: integer("rps_min_bet").notNull().default(100),
  rpsMaxBet: integer("rps_max_bet").notNull().default(100_000),
  rpsCooldownSeconds: integer("rps_cooldown_seconds").notNull().default(5),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const coinGameLogs = sqliteTable(
  "coin_game_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    gameType: text("game_type").notNull(),
    betAmount: integer("bet_amount").notNull(),
    result: text("result").notNull(),
    balanceDelta: integer("balance_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    guildUserTime: index("idx_coin_game_logs_guild_user_time").on(
      table.guildId,
      table.userId,
      table.createdAt,
    ),
    guildTime: index("idx_coin_game_logs_guild_time").on(
      table.guildId,
      table.createdAt,
    ),
  }),
);

export const coinWorkLogs = sqliteTable(
  "coin_work_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    workType: text("work_type").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    guildUserTime: index("idx_coin_work_logs_guild_user_time").on(
      table.guildId,
      table.userId,
      table.createdAt,
    ),
    guildTime: index("idx_coin_work_logs_guild_time").on(
      table.guildId,
      table.createdAt,
    ),
  }),
);

export const coinFishingLogs = sqliteTable(
  "coin_fishing_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    fishName: text("fish_name").notNull(),
    rarity: text("rarity").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    guildUserTime: index("idx_coin_fishing_logs_guild_user_time").on(
      table.guildId,
      table.userId,
      table.createdAt,
    ),
    guildTime: index("idx_coin_fishing_logs_guild_time").on(
      table.guildId,
      table.createdAt,
    ),
  }),
);

export const coinDailyMissions = sqliteTable(
  "coin_daily_missions",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    missionKey: text("mission_key").notNull(),
    completedAt: text("completed_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.guildId, table.userId, table.date, table.missionKey],
    }),
    guildUserDate: index("idx_coin_daily_missions_guild_user_date").on(
      table.guildId,
      table.userId,
      table.date,
    ),
  }),
);

export const coinDailyMissionRewards = sqliteTable(
  "coin_daily_mission_rewards",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    claimedAt: text("claimed_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId, table.date] }),
  }),
);

export const coinInventoryItems = sqliteTable(
  "coin_inventory_items",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    itemKey: text("item_key").notNull(),
    itemType: text("item_type").notNull(),
    itemName: text("item_name").notNull(),
    pricePaid: integer("price_paid").notNull(),
    purchasedAt: text("purchased_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.guildId, table.userId, table.itemKey],
    }),
    guildUser: index("idx_coin_inventory_items_guild_user").on(
      table.guildId,
      table.userId,
    ),
    guildItem: index("idx_coin_inventory_items_guild_item").on(
      table.guildId,
      table.itemKey,
    ),
  }),
);

export const coinEquippedItems = sqliteTable(
  "coin_equipped_items",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    itemType: text("item_type").notNull(),
    itemKey: text("item_key").notNull(),
    equippedAt: text("equipped_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId, table.itemType] }),
    guildUser: index("idx_coin_equipped_items_guild_user").on(
      table.guildId,
      table.userId,
    ),
  }),
);

export const coinAchievementRewards = sqliteTable(
  "coin_achievement_rewards",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    achievementKey: text("achievement_key").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    claimedAt: text("claimed_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.guildId, table.userId, table.achievementKey],
    }),
    guildUser: index("idx_coin_achievement_rewards_guild_user").on(
      table.guildId,
      table.userId,
    ),
  }),
);

export const coinSwords = sqliteTable(
  "coin_swords",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    level: integer("level").notNull().default(0),
    totalAttempts: integer("total_attempts").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    downgradeCount: integer("downgrade_count").notNull().default(0),
    destroyCount: integer("destroy_count").notNull().default(0),
    highestLevel: integer("highest_level").notNull().default(0),
    lastEnhancedAt: text("last_enhanced_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId] }),
    guildLevel: index("idx_coin_swords_guild_level").on(
      table.guildId,
      table.level,
      table.highestLevel,
    ),
    guildUser: index("idx_coin_swords_guild_user").on(
      table.guildId,
      table.userId,
    ),
  }),
);

export const coinDungeonRuns = sqliteTable(
  "coin_dungeon_runs",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    swordLevel: integer("sword_level").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.guildId, table.userId, table.date],
    }),
    guildDate: index("idx_coin_dungeon_runs_guild_date").on(
      table.guildId,
      table.date,
    ),
    guildUserTime: index("idx_coin_dungeon_runs_guild_user_time").on(
      table.guildId,
      table.userId,
      table.createdAt,
    ),
  }),
);

export const coinConsumableItems = sqliteTable(
  "coin_consumable_items",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    itemKey: text("item_key").notNull(),
    itemName: text("item_name").notNull(),
    quantity: integer("quantity").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.guildId, table.userId, table.itemKey],
    }),
    guildUser: index("idx_coin_consumable_items_guild_user").on(
      table.guildId,
      table.userId,
    ),
    guildItem: index("idx_coin_consumable_items_guild_item").on(
      table.guildId,
      table.itemKey,
    ),
  }),
);

export const fortuneProfiles = sqliteTable("fortune_profiles", {
  userId: text("user_id").primaryKey(),
  profileCiphertext: text("profile_ciphertext").notNull(),
  profileIv: text("profile_iv").notNull(),
  profileTag: text("profile_tag").notNull(),
  keyVersion: integer("key_version").notNull().default(1),
  privacyNoticeVersion: text("privacy_notice_version").notNull(),
  consentedAt: text("consented_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
