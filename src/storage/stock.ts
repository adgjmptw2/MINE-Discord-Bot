import { db } from "@/storage/db";
import type { StockPrice } from "@/services/stock/types";

export const STOCK_QUANTITY_SCALE = 1_000_000;

export const DAILY_ATTENDANCE_REWARD = 10_000;

export interface StockWallet {
  guildId: string;
  userId: string;
  cashBalance: number;
  totalDeposit: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockHolding {
  guildId: string;
  userId: string;
  symbol: string;
  quantityMicro: number;
  averageBuyPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockAssetSummary {
  wallet: StockWallet;
  holdings: StockHolding[];
  cashTotal: number;
  stockValueTotal: number;
  totalAssets: number;
  profitLossPercent: number;
  unavailableSymbols: string[];
}

interface WalletRow {
  guild_id: string;
  user_id: string;
  cash_balance: number;
  total_deposit: number;
  created_at: string;
  updated_at: string;
}

interface HoldingRow {
  guild_id: string;
  user_id: string;
  symbol: string;
  quantity_micro: number;
  average_buy_price: number;
  created_at: string;
  updated_at: string;
}

function mapWallet(row: WalletRow): StockWallet {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    cashBalance: Number(row.cash_balance),
    totalDeposit: Number(row.total_deposit),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHolding(row: HoldingRow): StockHolding {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    symbol: row.symbol,
    quantityMicro: Number(row.quantity_micro),
    averageBuyPrice: Number(row.average_buy_price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWalletRow(guildId: string, userId: string): WalletRow | undefined {
  return db.get<WalletRow>(
    `SELECT guild_id, user_id, cash_balance, total_deposit, created_at, updated_at
     FROM stock_wallets WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId],
  );
}

function ensureWalletRow(guildId: string, userId: string, nowIso: string): WalletRow {
  let row = getWalletRow(guildId, userId);
  if (row) {
    return row;
  }
  db.run(
    `INSERT INTO stock_wallets (guild_id, user_id, cash_balance, total_deposit, created_at, updated_at)
     VALUES (?, ?, 0, 0, ?, ?)`,
    [guildId, userId, nowIso, nowIso],
  );
  row = getWalletRow(guildId, userId);
  if (!row) {
    throw new Error("stock_wallets insert failed");
  }
  return row;
}

export function getStockWallet(guildId: string, userId: string): StockWallet | null {
  const row = getWalletRow(guildId, userId);
  return row ? mapWallet(row) : null;
}

export function getOrCreateStockWallet(guildId: string, userId: string): StockWallet {
  const now = new Date().toISOString();
  const row = ensureWalletRow(guildId, userId, now);
  return mapWallet(row);
}

export function listStockHoldings(guildId: string, userId: string): StockHolding[] {
  const rows = db.all<HoldingRow>(
    `SELECT guild_id, user_id, symbol, quantity_micro, average_buy_price, created_at, updated_at
     FROM stock_holdings
     WHERE guild_id = ? AND user_id = ? AND quantity_micro > 0
     ORDER BY symbol ASC`,
    [guildId, userId],
  );
  return rows.map(mapHolding);
}

export function recordStockAttendance(
  guildId: string,
  userId: string,
  date: string,
  rewardAmount = DAILY_ATTENDANCE_REWARD,
): { alreadyClaimed: boolean; wallet: StockWallet; rewardAmount: number } {
  db.run("BEGIN IMMEDIATE");
  try {
    const dup = db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ? AND date = ?`,
      [guildId, userId, date],
    );
    const already = Number(dup?.n ?? 0) > 0;
    const now = new Date().toISOString();

    if (already) {
      ensureWalletRow(guildId, userId, now);
      const w = getWalletRow(guildId, userId)!;
      db.run("COMMIT");
      return { alreadyClaimed: true, wallet: mapWallet(w), rewardAmount };
    }

    ensureWalletRow(guildId, userId, now);
    db.run(
      `UPDATE stock_wallets
       SET cash_balance = cash_balance + ?,
           total_deposit = total_deposit + ?,
           updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [rewardAmount, rewardAmount, now, guildId, userId],
    );
    db.run(
      `INSERT INTO stock_daily_attendance (guild_id, user_id, date, reward_amount, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [guildId, userId, date, rewardAmount, now],
    );
    const updated = getWalletRow(guildId, userId)!;
    db.run("COMMIT");
    return { alreadyClaimed: false, wallet: mapWallet(updated), rewardAmount };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

export function getStockAssetSummary(
  guildId: string,
  userId: string,
  prices: StockPrice[] = [],
): StockAssetSummary | null {
  const walletRow = getWalletRow(guildId, userId);
  if (!walletRow) {
    return null;
  }
  const wallet = mapWallet(walletRow);
  const holdings = listStockHoldings(guildId, userId);

  const priceBySymbol = new Map<string, number>();
  for (const p of prices) {
    priceBySymbol.set(p.symbol, p.price);
  }

  const unavailableSymbols: string[] = [];
  let stockValueTotal = 0;

  for (const h of holdings) {
    const px = priceBySymbol.get(h.symbol);
    if (px === undefined) {
      unavailableSymbols.push(h.symbol);
      continue;
    }
    const qty = h.quantityMicro / STOCK_QUANTITY_SCALE;
    stockValueTotal += Math.round(qty * px);
  }

  const cashTotal = wallet.cashBalance;
  const totalAssets = cashTotal + stockValueTotal;
  const td = wallet.totalDeposit;
  const profitLossPercent =
    td > 0 ? ((totalAssets - td) / td) * 100 : 0;

  return {
    wallet,
    holdings,
    cashTotal,
    stockValueTotal,
    totalAssets,
    profitLossPercent,
    unavailableSymbols,
  };
}
