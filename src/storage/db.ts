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
  Database: new (filename: string, options?: { create?: boolean }) => BunDatabaseLike;
};

interface SqliteAdapter {
  exec(sql: string): void;
  get<T>(sql: string, params?: SqlParams): T | undefined;
  all<T>(sql: string, params?: SqlParams): T[];
  run(sql: string, params?: SqlParams): void;
}

function createAdapter(): SqliteAdapter {
  const runtimeRequire = eval("require") as NodeRequire;
  const isBunRuntime = typeof (globalThis as typeof globalThis & { Bun?: unknown }).Bun !== "undefined";

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

  const Database = runtimeRequire("better-sqlite3") as typeof import("better-sqlite3");
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
`);

export const db = sqlite;
