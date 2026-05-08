import { db } from "@/storage/db";
import type { StockPrice } from "@/services/stock/types";

export const STOCK_QUANTITY_SCALE = 1_000_000;

export const STOCK_TRADE_FEE_RATE = 0.001;

/** 최소 매수 금액 (코인) */
export const MIN_STOCK_BUY_AMOUNT = 1_000;

/** 최소 매도 금액 기준(코인, 금액 방식일 때) */
export const MIN_STOCK_SELL_AMOUNT = 1_000;

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

/** 길드 모의투자 랭킹 한 줄 (캐시 시세 기준) */
export interface StockRankingEntry {
  guildId: string;
  userId: string;
  cashBalance: number;
  stockValueTotal: number;
  totalAssets: number;
  totalDeposit: number;
  profitLoss: number;
  profitLossPercent: number;
  unavailableSymbols: string[];
}

export type StockStorageErrorCode =
  | "WALLET_NOT_FOUND"
  | "INSUFFICIENT_CASH"
  | "HOLDING_NOT_FOUND"
  | "INSUFFICIENT_HOLDING"
  | "INVALID_AMOUNT"
  | "INVALID_PERCENT"
  | "INVALID_PRICE"
  | "QUANTITY_TOO_SMALL";

export class StockStorageError extends Error {
  readonly code: StockStorageErrorCode;

  constructor(code: StockStorageErrorCode, message?: string) {
    super(message ?? code);
    this.name = "StockStorageError";
    this.code = code;
  }
}

export interface BuyStockParams {
  guildId: string;
  userId: string;
  symbol: string;
  price: number;
  amount: number;
}

export interface BuyStockResult {
  wallet: StockWallet;
  holding: StockHolding;
  tradeId: number;
  symbol: string;
  price: number;
  amount: number;
  fee: number;
  grossAmount: number;
  netAmount: number;
  quantityMicro: number;
  totalQuantityMicro: number;
  averageBuyPrice: number;
}

export interface SellStockParams {
  guildId: string;
  userId: string;
  symbol: string;
  price: number;
  mode: "amount" | "percent" | "all";
  amount?: number;
  percent?: number;
}

export interface SellStockResult {
  wallet: StockWallet;
  holding: StockHolding | null;
  tradeId: number;
  symbol: string;
  price: number;
  soldQuantityMicro: number;
  remainingQuantityMicro: number;
  grossAmount: number;
  fee: number;
  netAmount: number;
  realizedProfit: number;
  averageBuyPrice: number;
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

function getHoldingRow(
  guildId: string,
  userId: string,
  symbol: string,
): HoldingRow | undefined {
  return db.get<HoldingRow>(
    `SELECT guild_id, user_id, symbol, quantity_micro, average_buy_price, created_at, updated_at
     FROM stock_holdings WHERE guild_id = ? AND user_id = ? AND symbol = ?`,
    [guildId, userId, symbol],
  );
}

function getStatementChanges(): number {
  const row = db.get<{ n: number }>("SELECT changes() AS n");
  return Number(row?.n ?? 0);
}

function ensureWalletRow(
  guildId: string,
  userId: string,
  nowIso: string,
): WalletRow {
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

export function getStockWallet(
  guildId: string,
  userId: string,
): StockWallet | null {
  const row = getWalletRow(guildId, userId);
  return row ? mapWallet(row) : null;
}

export function getOrCreateStockWallet(
  guildId: string,
  userId: string,
): StockWallet {
  const now = new Date().toISOString();
  const row = ensureWalletRow(guildId, userId, now);
  return mapWallet(row);
}

export function listStockHoldings(
  guildId: string,
  userId: string,
): StockHolding[] {
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
  const profitLossPercent = td > 0 ? ((totalAssets - td) / td) * 100 : 0;

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

/**
 * 길드 내 모든 지갑·보유를 읽어 총자산 순으로 정렬한다.
 * 총자산이 정확히 0인 행은 제외한다(미참여·빈 지갑 노이즈 감소).
 * 클라이언트에서 지갑만 있고 입금·매수 전인 경우도 cash 0이면 제외됨.
 */
export function getStockRanking(
  guildId: string,
  prices: StockPrice[],
  limit = 10,
): StockRankingEntry[] {
  const walletRows = db.all<WalletRow>(
    `SELECT guild_id, user_id, cash_balance, total_deposit, created_at, updated_at
     FROM stock_wallets WHERE guild_id = ?`,
    [guildId],
  );

  const holdingRows = db.all<HoldingRow>(
    `SELECT guild_id, user_id, symbol, quantity_micro, average_buy_price, created_at, updated_at
     FROM stock_holdings WHERE guild_id = ? AND quantity_micro > 0`,
    [guildId],
  );

  const priceBySymbol = new Map<string, number>();
  for (const p of prices) {
    priceBySymbol.set(p.symbol, p.price);
  }

  const holdingsByUser = new Map<string, HoldingRow[]>();
  for (const row of holdingRows) {
    const uid = row.user_id;
    const list = holdingsByUser.get(uid);
    if (list) {
      list.push(row);
    } else {
      holdingsByUser.set(uid, [row]);
    }
  }

  const entries: StockRankingEntry[] = [];

  for (const wRow of walletRows) {
    const wallet = mapWallet(wRow);
    const uid = wallet.userId;
    const rows = holdingsByUser.get(uid) ?? [];
    const unavailableSymbols: string[] = [];
    let stockValueTotal = 0;

    for (const h of rows) {
      const px = priceBySymbol.get(h.symbol);
      if (px === undefined) {
        unavailableSymbols.push(h.symbol);
        continue;
      }
      const qty = Number(h.quantity_micro) / STOCK_QUANTITY_SCALE;
      stockValueTotal += Math.round(qty * px);
    }

    const cashBalance = wallet.cashBalance;
    const totalDeposit = wallet.totalDeposit;
    const totalAssets = cashBalance + stockValueTotal;
    const profitLoss = totalAssets - totalDeposit;
    const profitLossPercent =
      totalDeposit > 0 ? (profitLoss / totalDeposit) * 100 : 0;

    if (totalAssets === 0) {
      continue;
    }

    entries.push({
      guildId,
      userId: uid,
      cashBalance,
      stockValueTotal,
      totalAssets,
      totalDeposit,
      profitLoss,
      profitLossPercent,
      unavailableSymbols,
    });
  }

  entries.sort((a, b) => {
    if (b.totalAssets !== a.totalAssets) {
      return b.totalAssets - a.totalAssets;
    }
    return b.profitLossPercent - a.profitLossPercent;
  });

  return entries.slice(0, limit);
}

export function buyStock(params: BuyStockParams): BuyStockResult {
  const guildId = params.guildId;
  const userId = params.userId;
  const symbol = params.symbol.trim();
  const priceRaw = params.price;
  const amount = params.amount;

  if (!Number.isFinite(amount) || amount < MIN_STOCK_BUY_AMOUNT) {
    throw new StockStorageError("INVALID_AMOUNT");
  }
  if (!Number.isFinite(priceRaw) || priceRaw <= 0) {
    throw new StockStorageError("INVALID_PRICE");
  }

  const priceRounded = Math.round(priceRaw);
  const fee = Math.floor(amount * STOCK_TRADE_FEE_RATE);
  const netAmount = amount + fee;
  const quantityMicro = Math.floor(
    (amount / priceRounded) * STOCK_QUANTITY_SCALE,
  );

  if (quantityMicro <= 0) {
    throw new StockStorageError("QUANTITY_TOO_SMALL");
  }

  db.run("BEGIN IMMEDIATE");
  try {
    const walletRow = getWalletRow(guildId, userId);
    if (!walletRow) {
      throw new StockStorageError("WALLET_NOT_FOUND");
    }

    const now = new Date().toISOString();

    db.run(
      `UPDATE stock_wallets
       SET cash_balance = cash_balance - ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ? AND cash_balance >= ?`,
      [netAmount, now, guildId, userId, netAmount],
    );

    if (getStatementChanges() === 0) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }

    const existing = getHoldingRow(guildId, userId, symbol);
    const oldQty = existing ? Number(existing.quantity_micro) : 0;
    const oldAvg = existing ? Number(existing.average_buy_price) : 0;

    let totalQuantityMicro: number;
    let averageBuyPrice: number;

    if (oldQty <= 0) {
      totalQuantityMicro = quantityMicro;
      averageBuyPrice = priceRounded;
    } else {
      const totalCostBefore = (oldQty / STOCK_QUANTITY_SCALE) * oldAvg;
      const totalCostAfter = totalCostBefore + amount;
      totalQuantityMicro = oldQty + quantityMicro;
      averageBuyPrice = Math.round(
        totalCostAfter / (totalQuantityMicro / STOCK_QUANTITY_SCALE),
      );
    }

    if (!existing) {
      db.run(
        `INSERT INTO stock_holdings (guild_id, user_id, symbol, quantity_micro, average_buy_price, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          guildId,
          userId,
          symbol,
          totalQuantityMicro,
          averageBuyPrice,
          now,
          now,
        ],
      );
    } else {
      db.run(
        `UPDATE stock_holdings
         SET quantity_micro = ?, average_buy_price = ?, updated_at = ?
         WHERE guild_id = ? AND user_id = ? AND symbol = ?`,
        [totalQuantityMicro, averageBuyPrice, now, guildId, userId, symbol],
      );
    }

    db.run(
      `INSERT INTO stock_trades (guild_id, user_id, symbol, side, quantity_micro, price, gross_amount, fee, net_amount, realized_profit, created_at)
       VALUES (?, ?, ?, 'BUY', ?, ?, ?, ?, ?, NULL, ?)`,
      [
        guildId,
        userId,
        symbol,
        quantityMicro,
        priceRounded,
        amount,
        fee,
        netAmount,
        now,
      ],
    );

    const idRow = db.get<{ id: number }>("SELECT last_insert_rowid() AS id");
    const tradeId = Number(idRow?.id ?? 0);

    const walletAfter = getWalletRow(guildId, userId)!;
    const holdingAfter = getHoldingRow(guildId, userId, symbol)!;

    db.run("COMMIT");

    return {
      wallet: mapWallet(walletAfter),
      holding: mapHolding(holdingAfter),
      tradeId,
      symbol,
      price: priceRounded,
      amount,
      fee,
      grossAmount: amount,
      netAmount,
      quantityMicro,
      totalQuantityMicro,
      averageBuyPrice,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

export function sellStock(params: SellStockParams): SellStockResult {
  const guildId = params.guildId;
  const userId = params.userId;
  const symbol = params.symbol.trim();
  const priceRaw = params.price;

  if (!Number.isFinite(priceRaw) || priceRaw <= 0) {
    throw new StockStorageError("INVALID_PRICE");
  }

  const priceRounded = Math.round(priceRaw);

  db.run("BEGIN IMMEDIATE");
  try {
    const walletRow = getWalletRow(guildId, userId);
    if (!walletRow) {
      throw new StockStorageError("WALLET_NOT_FOUND");
    }

    const holdingRow = getHoldingRow(guildId, userId, symbol);
    const hq = holdingRow ? Number(holdingRow.quantity_micro) : 0;
    if (!holdingRow || hq <= 0) {
      throw new StockStorageError("HOLDING_NOT_FOUND");
    }

    const avgBuy = Number(holdingRow.average_buy_price);

    let soldQuantityMicro: number;

    if (params.mode === "all") {
      soldQuantityMicro = hq;
    } else if (params.mode === "percent") {
      const p = params.percent;
      if (p === undefined || !Number.isFinite(p)) {
        throw new StockStorageError("INVALID_PERCENT");
      }
      if (!Number.isInteger(p)) {
        throw new StockStorageError("INVALID_PERCENT");
      }
      if (p < 1 || p > 100) {
        throw new StockStorageError("INVALID_PERCENT");
      }
      if (p === 100) {
        soldQuantityMicro = hq;
      } else {
        soldQuantityMicro = Math.floor((hq * p) / 100);
      }
    } else {
      const amount = params.amount;
      if (amount === undefined || !Number.isFinite(amount)) {
        throw new StockStorageError("INVALID_AMOUNT");
      }
      if (amount < MIN_STOCK_SELL_AMOUNT) {
        throw new StockStorageError("INVALID_AMOUNT");
      }
      soldQuantityMicro = Math.floor(
        (amount / priceRounded) * STOCK_QUANTITY_SCALE,
      );
      if (soldQuantityMicro > hq) {
        throw new StockStorageError("INSUFFICIENT_HOLDING");
      }
    }

    if (soldQuantityMicro <= 0) {
      throw new StockStorageError("QUANTITY_TOO_SMALL");
    }
    if (soldQuantityMicro > hq) {
      throw new StockStorageError("INSUFFICIENT_HOLDING");
    }

    const grossAmount = Math.floor(
      (soldQuantityMicro / STOCK_QUANTITY_SCALE) * priceRounded,
    );
    const fee = Math.floor(grossAmount * STOCK_TRADE_FEE_RATE);
    const netAmount = grossAmount - fee;
    const costBasis = Math.floor(
      (soldQuantityMicro / STOCK_QUANTITY_SCALE) * avgBuy,
    );
    const realizedProfit = netAmount - costBasis;

    const remainingQuantityMicro = hq - soldQuantityMicro;

    const now = new Date().toISOString();

    db.run(
      `UPDATE stock_holdings
       SET quantity_micro = quantity_micro - ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ? AND symbol = ? AND quantity_micro >= ?`,
      [soldQuantityMicro, now, guildId, userId, symbol, soldQuantityMicro],
    );

    if (getStatementChanges() === 0) {
      throw new StockStorageError("INSUFFICIENT_HOLDING");
    }

    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance + ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [netAmount, now, guildId, userId],
    );

    if (remainingQuantityMicro <= 0) {
      db.run(
        `DELETE FROM stock_holdings WHERE guild_id = ? AND user_id = ? AND symbol = ?`,
        [guildId, userId, symbol],
      );
    }

    db.run(
      `INSERT INTO stock_trades (guild_id, user_id, symbol, side, quantity_micro, price, gross_amount, fee, net_amount, realized_profit, created_at)
       VALUES (?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        userId,
        symbol,
        soldQuantityMicro,
        priceRounded,
        grossAmount,
        fee,
        netAmount,
        realizedProfit,
        now,
      ],
    );

    const idRow = db.get<{ id: number }>("SELECT last_insert_rowid() AS id");
    const tradeId = Number(idRow?.id ?? 0);

    const walletAfter = getWalletRow(guildId, userId)!;
    const holdingAfter =
      remainingQuantityMicro <= 0
        ? null
        : getHoldingRow(guildId, userId, symbol)!;

    db.run("COMMIT");

    return {
      wallet: mapWallet(walletAfter),
      holding: holdingAfter ? mapHolding(holdingAfter) : null,
      tradeId,
      symbol,
      price: priceRounded,
      soldQuantityMicro,
      remainingQuantityMicro:
        remainingQuantityMicro <= 0 ? 0 : remainingQuantityMicro,
      grossAmount,
      fee,
      netAmount,
      realizedProfit,
      averageBuyPrice: avgBuy,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}
