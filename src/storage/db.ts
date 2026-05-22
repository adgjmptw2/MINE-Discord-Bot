import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const storageDir = path.join(process.cwd(), "storage");
const mineDb = path.join(storageDir, "mine.sqlite");

if (!existsSync(storageDir)) {
  mkdirSync(storageDir, { recursive: true });
}

const storageFile = mineDb;

type SqlParams = readonly unknown[];
type QueryExecutor = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => unknown;
};
type BunDatabaseLike = {
  exec: (sql: string) => void;
  query: (sql: string) => QueryExecutor;
};
type BunSqliteModule = {
  Database: new (
    filename: string,
    options?: { create?: boolean },
  ) => BunDatabaseLike;
};

interface SqliteAdapter {
  exec(sql: string): void;
  get<T>(sql: string, params?: SqlParams): T | undefined;
  all<T>(sql: string, params?: SqlParams): T[];
  run(sql: string, params?: SqlParams): void;
}

function createAdapter(): SqliteAdapter {
  const runtimeRequire = eval("require") as NodeRequire;
  const isBunRuntime =
    typeof (globalThis as typeof globalThis & { Bun?: unknown }).Bun !==
    "undefined";

  if (isBunRuntime) {
    const { Database } = runtimeRequire("bun:sqlite") as BunSqliteModule;
    const sqlite = new Database(storageFile, { create: true });

    return {
      exec(sql: string) {
        sqlite.exec(sql);
      },
      get<T>(sql: string, params: SqlParams = []) {
        return sqlite.query(sql).get(...params) as T | undefined;
      },
      all<T>(sql: string, params: SqlParams = []) {
        return sqlite.query(sql).all(...params) as T[];
      },
      run(sql: string, params: SqlParams = []) {
        sqlite.query(sql).run(...params);
      },
    };
  }

  const Database = runtimeRequire(
    "better-sqlite3",
  ) as typeof import("better-sqlite3");
  const sqlite = new Database(storageFile);

  return {
    exec(sql: string) {
      sqlite.exec(sql);
    },
    get<T>(sql: string, params: SqlParams = []) {
      return sqlite.prepare(sql).get(...params) as T | undefined;
    },
    all<T>(sql: string, params: SqlParams = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    run(sql: string, params: SqlParams = []) {
      sqlite.prepare(sql).run(...params);
    },
  };
}

const sqlite = createAdapter();

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    name_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(owner_id, name_key)
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    uri TEXT NOT NULL,
    author TEXT NOT NULL,
    order_index INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_order
    ON playlist_tracks (playlist_id, order_index);

  CREATE TABLE IF NOT EXISTS soundroom (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    panel_message_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS music_guild_recent_play (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    uri TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    played_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_music_guild_recent_guild_time
    ON music_guild_recent_play (guild_id, played_at DESC);

  CREATE INDEX IF NOT EXISTS idx_music_guild_recent_guild_id
    ON music_guild_recent_play (guild_id, id DESC);

  CREATE TABLE IF NOT EXISTS soundroom_chart_source (
    guild_id TEXT PRIMARY KEY,
    playlist_url TEXT NOT NULL,
    priority_video_id TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock_wallets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cash_balance INTEGER NOT NULL DEFAULT 0,
    total_deposit INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS stock_holdings (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity_micro INTEGER NOT NULL DEFAULT 0,
    average_buy_price INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, symbol)
  );

  CREATE INDEX IF NOT EXISTS idx_stock_holdings_guild_user
    ON stock_holdings (guild_id, user_id);

  CREATE INDEX IF NOT EXISTS idx_stock_holdings_symbol
    ON stock_holdings (symbol);

  CREATE TABLE IF NOT EXISTS stock_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity_micro INTEGER NOT NULL,
    price INTEGER NOT NULL,
    gross_amount INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    net_amount INTEGER NOT NULL,
    realized_profit INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_stock_trades_guild_user_time
    ON stock_trades (guild_id, user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_stock_trades_guild_time
    ON stock_trades (guild_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_stock_trades_symbol_time
    ON stock_trades (symbol, created_at DESC);

  CREATE TABLE IF NOT EXISTS stock_daily_attendance (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_stock_daily_attendance_guild_date
    ON stock_daily_attendance (guild_id, date);

  CREATE TABLE IF NOT EXISTS stock_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_seasons_one_active_per_guild
    ON stock_seasons (guild_id) WHERE status = 'ACTIVE';

  CREATE TABLE IF NOT EXISTS stock_season_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    total_assets INTEGER NOT NULL,
    cash_balance INTEGER NOT NULL,
    stock_value_total INTEGER NOT NULL,
    profit_loss INTEGER NOT NULL,
    profit_loss_percent REAL NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_stock_season_results_season_rank
    ON stock_season_results (season_id, rank);

  CREATE INDEX IF NOT EXISTS idx_stock_season_results_guild_time
    ON stock_season_results (guild_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS coin_game_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type = 'RPS'),
    bet_amount INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('WIN', 'LOSE', 'DRAW')),
    balance_delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_coin_game_logs_guild_user_time
    ON coin_game_logs (guild_id, user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_coin_game_logs_guild_time
    ON coin_game_logs (guild_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS coin_guild_settings (
    guild_id TEXT PRIMARY KEY,
    attendance_reward INTEGER NOT NULL DEFAULT 10000,
    rps_min_bet INTEGER NOT NULL DEFAULT 100,
    rps_max_bet INTEGER NOT NULL DEFAULT 100000,
    rps_cooldown_seconds INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coin_work_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    work_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_coin_work_logs_guild_user_time
    ON coin_work_logs (guild_id, user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_coin_work_logs_guild_time
    ON coin_work_logs (guild_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS coin_fishing_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    fish_name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_coin_fishing_logs_guild_user_time
    ON coin_fishing_logs (guild_id, user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_coin_fishing_logs_guild_time
    ON coin_fishing_logs (guild_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS coin_daily_missions (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    mission_key TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, date, mission_key)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_daily_missions_guild_user_date
    ON coin_daily_missions (guild_id, user_id, date);

  CREATE TABLE IF NOT EXISTS coin_daily_mission_rewards (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    claimed_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, date)
  );

  CREATE TABLE IF NOT EXISTS coin_inventory_items (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price_paid INTEGER NOT NULL,
    purchased_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, item_key)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_inventory_items_guild_user
    ON coin_inventory_items (guild_id, user_id);

  CREATE INDEX IF NOT EXISTS idx_coin_inventory_items_guild_item
    ON coin_inventory_items (guild_id, item_key);

  CREATE TABLE IF NOT EXISTS coin_equipped_items (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_key TEXT NOT NULL,
    equipped_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, item_type)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_equipped_items_guild_user
    ON coin_equipped_items (guild_id, user_id);

  CREATE TABLE IF NOT EXISTS coin_achievement_rewards (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    achievement_key TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    claimed_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, achievement_key)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_achievement_rewards_guild_user
    ON coin_achievement_rewards (guild_id, user_id);

  CREATE TABLE IF NOT EXISTS coin_swords (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 20),
    total_attempts INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    downgrade_count INTEGER NOT NULL DEFAULT 0,
    destroy_count INTEGER NOT NULL DEFAULT 0,
    highest_level INTEGER NOT NULL DEFAULT 0,
    last_enhanced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_swords_guild_level
    ON coin_swords (guild_id, level DESC, highest_level DESC);

  CREATE INDEX IF NOT EXISTS idx_coin_swords_guild_user
    ON coin_swords (guild_id, user_id);

  CREATE TABLE IF NOT EXISTS coin_dungeon_runs (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    sword_level INTEGER NOT NULL,
    reward_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_dungeon_runs_guild_date
    ON coin_dungeon_runs (guild_id, date);

  CREATE INDEX IF NOT EXISTS idx_coin_dungeon_runs_guild_user_time
    ON coin_dungeon_runs (guild_id, user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS coin_consumable_items (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, item_key)
  );

  CREATE INDEX IF NOT EXISTS idx_coin_consumable_items_guild_user
    ON coin_consumable_items (guild_id, user_id);

  CREATE INDEX IF NOT EXISTS idx_coin_consumable_items_guild_item
    ON coin_consumable_items (guild_id, item_key);

  CREATE TABLE IF NOT EXISTS fortune_profiles (
    user_id TEXT PRIMARY KEY,
    profile_ciphertext TEXT NOT NULL,
    profile_iv TEXT NOT NULL,
    profile_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    privacy_notice_version TEXT NOT NULL,
    consented_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export const db = sqlite;

export function checkDatabaseHealth(): boolean {
  try {
    sqlite.get<{ ok: number }>("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}
