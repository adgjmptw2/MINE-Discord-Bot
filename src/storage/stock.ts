import { randomInt } from "node:crypto";
import { db } from "@/storage/db";
import type { StockPrice } from "@/services/stock/types";
import { getCoinShopItems, type CoinShopItem } from "@/settings/coinShopItems";
import { getKstDayUtcIsoBounds } from "@/utils/date";
import { log } from "@/utils/logger";

export const STOCK_QUANTITY_SCALE = 1_000_000;

export const STOCK_TRADE_FEE_RATE = 0.001;

/** 최소 매수 금액 (코인) */
export const MIN_STOCK_BUY_AMOUNT = 1_000;

/** 최소 매도 금액 기준(코인, 금액 방식일 때) */
export const MIN_STOCK_SELL_AMOUNT = 1_000;

export const DEFAULT_ATTENDANCE_REWARD = 10_000;
export const DEFAULT_RPS_MIN_BET = 100;
export const DEFAULT_RPS_MAX_BET = 100_000;
export const DEFAULT_RPS_COOLDOWN_SECONDS = 5;

/** 호환·폴백용 — 서버별 출석액은 `getOrCreateCoinGuildSettings` */
export const DAILY_ATTENDANCE_REWARD = DEFAULT_ATTENDANCE_REWARD;

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

/** 관리자 초기화 결과 건수 */
export interface StockResetCounts {
  deletedWallets: number;
  deletedHoldings: number;
  deletedTrades: number;
  deletedAttendances: number;
}

export type StockSeasonStatus = "ACTIVE" | "ENDED";

export interface StockSeason {
  id: number;
  guildId: string;
  name: string;
  status: StockSeasonStatus;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export interface StockSeasonResult {
  id: number;
  seasonId: number;
  guildId: string;
  userId: string;
  rank: number;
  totalAssets: number;
  cashBalance: number;
  stockValueTotal: number;
  profitLoss: number;
  profitLossPercent: number;
  createdAt: string;
}

/** createStockSeason 반환용 (생성된 시즌과 동일). */
export type CreateStockSeasonResult = StockSeason;

export interface EndStockSeasonResult {
  season: StockSeason;
  savedResults: StockSeasonResult[];
}

export type RpsChoice = "가위" | "바위" | "보";

export type RpsResult = "WIN" | "LOSE" | "DRAW";

export interface PlayRockPaperScissorsParams {
  guildId: string;
  userId: string;
  playerChoice: RpsChoice;
  betAmount: number;
  rpsMinBet: number;
  rpsMaxBet: number;
}

export interface PlayRockPaperScissorsResult {
  playerChoice: RpsChoice;
  botChoice: RpsChoice;
  result: RpsResult;
  betAmount: number;
  balanceDelta: number;
  balanceAfter: number;
  logId: number;
}

/** `coin_game_logs.metadata` JSON 파싱 결과 */
export interface CoinGameLogMetadataParsed {
  playerChoice?: string;
  botChoice?: string;
}

export interface CoinGameLogEntry {
  id: number;
  guildId: string;
  userId: string;
  gameType: string;
  betAmount: number;
  result: string;
  balanceDelta: number;
  balanceAfter: number;
  metadata: CoinGameLogMetadataParsed | null;
  createdAt: string;
}

export interface ListCoinGameLogsParams {
  guildId: string;
  userId?: string;
  limit?: number;
}

export interface CoinGuildSettings {
  guildId: string;
  attendanceReward: number;
  rpsMinBet: number;
  rpsMaxBet: number;
  rpsCooldownSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCoinGuildSettingsPatch {
  attendanceReward?: number;
  rpsMinBet?: number;
  rpsMaxBet?: number;
  rpsCooldownSeconds?: number;
}

/** 호환·폴백용 — 서버별 베팅 한도는 `getOrCreateCoinGuildSettings` */
export const MIN_RPS_BET = DEFAULT_RPS_MIN_BET;
export const MAX_RPS_BET = DEFAULT_RPS_MAX_BET;

/** /알바 쿨다운(초) — 서버 설정 없음(고정 30분) */
export const DEFAULT_WORK_COOLDOWN_SECONDS = 1800;

export const MIN_WORK_REWARD = 500;
export const MAX_WORK_REWARD = 2000;

export interface CoinWorkResult {
  rewardAmount: number;
  balanceAfter: number;
  workType: string;
  createdAt: string;
}

export interface CoinWorkCooldownResult {
  canWork: boolean;
  remainingMs: number;
  latestWorkedAt: string | null;
}

/** `/낚시` 쿨다운(초) — 고정 20분 */
export const DEFAULT_FISHING_COOLDOWN_SECONDS = 1200;

export type FishingRarity =
  | "NONE"
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "LEGENDARY";

export const FISHING_RARITY_NONE: FishingRarity = "NONE";
export const FISHING_RARITY_COMMON: FishingRarity = "COMMON";
export const FISHING_RARITY_UNCOMMON: FishingRarity = "UNCOMMON";
export const FISHING_RARITY_RARE: FishingRarity = "RARE";
export const FISHING_RARITY_LEGENDARY: FishingRarity = "LEGENDARY";

export interface CoinFishingLog {
  id: number;
  guildId: string;
  userId: string;
  fishName: string;
  rarity: FishingRarity;
  rewardAmount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface CoinFishingResult {
  fishName: string;
  rarity: FishingRarity;
  rewardAmount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface CoinFishingCooldownResult {
  canFish: boolean;
  remainingMs: number;
  latestFishedAt: string | null;
}

/** 일일 미션 전부 완료 시 1회 지급 (코인) */
export const DAILY_MISSION_REWARD = 3000;

export const DAILY_MISSION_KEY_ATTENDANCE = "ATTENDANCE" as const;
export const DAILY_MISSION_KEY_WORK = "WORK" as const;
export const DAILY_MISSION_KEY_FISHING = "FISHING" as const;
export const DAILY_MISSION_KEY_RPS = "RPS" as const;
export const DAILY_MISSION_KEY_STOCK_LIST = "STOCK_LIST" as const;

export type DailyMissionKey =
  | typeof DAILY_MISSION_KEY_ATTENDANCE
  | typeof DAILY_MISSION_KEY_WORK
  | typeof DAILY_MISSION_KEY_FISHING
  | typeof DAILY_MISSION_KEY_RPS
  | typeof DAILY_MISSION_KEY_STOCK_LIST;

export interface DailyMissionStatus {
  key: DailyMissionKey;
  label: string;
  completed: boolean;
}

export interface DailyMissionSummary {
  date: string;
  missions: DailyMissionStatus[];
  completedCount: number;
  totalCount: number;
  rewardClaimed: boolean;
  rewardAmount: number;
}

export interface CoinInventoryItem {
  guildId: string;
  userId: string;
  itemKey: string;
  itemType: string;
  itemName: string;
  pricePaid: number;
  purchasedAt: string;
}

export interface PurchaseCoinShopItemResult {
  item: CoinShopItem;
  wallet: StockWallet;
  balanceAfter: number;
}

export interface CoinEquippedItem {
  guildId: string;
  userId: string;
  itemType: string;
  itemKey: string;
  equippedAt: string;
}

export interface CoinProfileSummary {
  wallet: StockWallet | null;
  assetSummary: StockAssetSummary | null;
  equippedTitle: string | null;
  inventoryCount: number;
  latestGameLog: CoinGameLogEntry | null;
  activeSeason: StockSeason | null;
}

export type StockStorageErrorCode =
  | "WALLET_NOT_FOUND"
  | "INSUFFICIENT_CASH"
  | "HOLDING_NOT_FOUND"
  | "INSUFFICIENT_HOLDING"
  | "INVALID_AMOUNT"
  | "INVALID_PERCENT"
  | "INVALID_PRICE"
  | "QUANTITY_TOO_SMALL"
  | "ACTIVE_SEASON_EXISTS"
  | "ACTIVE_SEASON_NOT_FOUND"
  | "INVALID_SEASON_NAME"
  | "EMPTY_RANKING"
  | "INVALID_COIN_GUILD_SETTINGS"
  | "WORK_COOLDOWN"
  | "FISHING_COOLDOWN"
  | "DAILY_MISSION_NOT_COMPLETED"
  | "DAILY_MISSION_REWARD_ALREADY_CLAIMED"
  | "ITEM_NOT_FOUND"
  | "ITEM_ALREADY_OWNED"
  | "ITEM_NOT_OWNED"
  | "INVALID_ITEM_TYPE";

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

interface SeasonRow {
  id: number;
  guild_id: string;
  name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface SeasonResultRow {
  id: number;
  season_id: number;
  guild_id: string;
  user_id: string;
  rank: number;
  total_assets: number;
  cash_balance: number;
  stock_value_total: number;
  profit_loss: number;
  profit_loss_percent: number;
  created_at: string;
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

function mapSeason(row: SeasonRow): StockSeason {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    status: row.status as StockSeasonStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

function mapSeasonResult(row: SeasonResultRow): StockSeasonResult {
  return {
    id: row.id,
    seasonId: row.season_id,
    guildId: row.guild_id,
    userId: row.user_id,
    rank: row.rank,
    totalAssets: Number(row.total_assets),
    cashBalance: Number(row.cash_balance),
    stockValueTotal: Number(row.stock_value_total),
    profitLoss: Number(row.profit_loss),
    profitLossPercent: Number(row.profit_loss_percent),
    createdAt: row.created_at,
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

interface CoinGuildSettingsRow {
  guild_id: string;
  attendance_reward: number;
  rps_min_bet: number;
  rps_max_bet: number;
  rps_cooldown_seconds: number;
  created_at: string;
  updated_at: string;
}

function mapCoinGuildSettingsRow(row: CoinGuildSettingsRow): CoinGuildSettings {
  return {
    guildId: row.guild_id,
    attendanceReward: Number(row.attendance_reward),
    rpsMinBet: Number(row.rps_min_bet),
    rpsMaxBet: Number(row.rps_max_bet),
    rpsCooldownSeconds: Number(row.rps_cooldown_seconds),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertValidCoinGuildSettings(s: {
  attendanceReward: number;
  rpsMinBet: number;
  rpsMaxBet: number;
  rpsCooldownSeconds: number;
}): void {
  if (
    !Number.isInteger(s.attendanceReward) ||
    s.attendanceReward < 0 ||
    s.attendanceReward > 1_000_000
  ) {
    throw new StockStorageError("INVALID_COIN_GUILD_SETTINGS");
  }
  if (
    !Number.isInteger(s.rpsMinBet) ||
    s.rpsMinBet < 1 ||
    s.rpsMinBet > 1_000_000
  ) {
    throw new StockStorageError("INVALID_COIN_GUILD_SETTINGS");
  }
  if (
    !Number.isInteger(s.rpsMaxBet) ||
    s.rpsMaxBet < 1 ||
    s.rpsMaxBet > 1_000_000
  ) {
    throw new StockStorageError("INVALID_COIN_GUILD_SETTINGS");
  }
  if (s.rpsMinBet > s.rpsMaxBet) {
    throw new StockStorageError("INVALID_COIN_GUILD_SETTINGS");
  }
  if (
    !Number.isInteger(s.rpsCooldownSeconds) ||
    s.rpsCooldownSeconds < 0 ||
    s.rpsCooldownSeconds > 60
  ) {
    throw new StockStorageError("INVALID_COIN_GUILD_SETTINGS");
  }
}

export function getOrCreateCoinGuildSettings(
  guildId: string,
): CoinGuildSettings {
  const row = db.get<CoinGuildSettingsRow>(
    `SELECT guild_id, attendance_reward, rps_min_bet, rps_max_bet, rps_cooldown_seconds, created_at, updated_at
     FROM coin_guild_settings WHERE guild_id = ?`,
    [guildId],
  );
  if (row) {
    return mapCoinGuildSettingsRow(row);
  }
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO coin_guild_settings (
       guild_id, attendance_reward, rps_min_bet, rps_max_bet, rps_cooldown_seconds, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      guildId,
      DEFAULT_ATTENDANCE_REWARD,
      DEFAULT_RPS_MIN_BET,
      DEFAULT_RPS_MAX_BET,
      DEFAULT_RPS_COOLDOWN_SECONDS,
      now,
      now,
    ],
  );
  const inserted = db.get<CoinGuildSettingsRow>(
    `SELECT guild_id, attendance_reward, rps_min_bet, rps_max_bet, rps_cooldown_seconds, created_at, updated_at
     FROM coin_guild_settings WHERE guild_id = ?`,
    [guildId],
  );
  if (!inserted) {
    throw new Error("coin_guild_settings insert failed");
  }
  return mapCoinGuildSettingsRow(inserted);
}

export function updateCoinGuildSettings(
  guildId: string,
  patch: UpdateCoinGuildSettingsPatch,
): CoinGuildSettings {
  const current = getOrCreateCoinGuildSettings(guildId);
  const next = {
    attendanceReward: patch.attendanceReward ?? current.attendanceReward,
    rpsMinBet: patch.rpsMinBet ?? current.rpsMinBet,
    rpsMaxBet: patch.rpsMaxBet ?? current.rpsMaxBet,
    rpsCooldownSeconds:
      patch.rpsCooldownSeconds ?? current.rpsCooldownSeconds,
  };
  assertValidCoinGuildSettings(next);
  const now = new Date().toISOString();
  db.run(
    `UPDATE coin_guild_settings SET
       attendance_reward = ?,
       rps_min_bet = ?,
       rps_max_bet = ?,
       rps_cooldown_seconds = ?,
       updated_at = ?
     WHERE guild_id = ?`,
    [
      next.attendanceReward,
      next.rpsMinBet,
      next.rpsMaxBet,
      next.rpsCooldownSeconds,
      now,
      guildId,
    ],
  );
  return {
    guildId,
    ...next,
    createdAt: current.createdAt,
    updatedAt: now,
  };
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

/** 관리자 코인 지급/차감 상한 (코인) */
export const MAX_ADMIN_COIN_ADJUSTMENT = 1_000_000_000;

function validateAdminCoinAmount(amount: number): void {
  if (
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > MAX_ADMIN_COIN_ADJUSTMENT
  ) {
    throw new StockStorageError("INVALID_AMOUNT");
  }
}

/**
 * 관리자 지급: 지갑이 없으면 생성 후 cash·total_deposit 증가.
 */
export function addCoinsToWallet(
  guildId: string,
  userId: string,
  amount: number,
): StockWallet {
  validateAdminCoinAmount(amount);
  const now = new Date().toISOString();
  db.run("BEGIN IMMEDIATE");
  try {
    ensureWalletRow(guildId, userId, now);
    db.run(
      `UPDATE stock_wallets
       SET cash_balance = cash_balance + ?,
           total_deposit = total_deposit + ?,
           updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [amount, amount, now, guildId, userId],
    );
    const row = getWalletRow(guildId, userId)!;
    db.run("COMMIT");
    return mapWallet(row);
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

/**
 * 관리자 차감: 지갑 필수. cash만 감소, total_deposit 불변.
 */
export function removeCoinsFromWallet(
  guildId: string,
  userId: string,
  amount: number,
): StockWallet {
  validateAdminCoinAmount(amount);
  const now = new Date().toISOString();
  db.run("BEGIN IMMEDIATE");
  try {
    const row = getWalletRow(guildId, userId);
    if (!row) {
      throw new StockStorageError("WALLET_NOT_FOUND");
    }
    const cash = Number(row.cash_balance);
    if (cash < amount) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }
    db.run(
      `UPDATE stock_wallets
       SET cash_balance = cash_balance - ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [amount, now, guildId, userId],
    );
    const updated = getWalletRow(guildId, userId)!;
    db.run("COMMIT");
    return mapWallet(updated);
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

/** 특정 유저의 길드 내 모의투자 데이터 삭제 (거래 → 보유 → 출석 → 지갑 순). */
export function resetStockUserData(
  guildId: string,
  userId: string,
): StockResetCounts {
  db.run("BEGIN IMMEDIATE");
  try {
    db.run(
      `DELETE FROM stock_trades WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    const deletedTrades = getStatementChanges();
    db.run(
      `DELETE FROM stock_holdings WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    const deletedHoldings = getStatementChanges();
    db.run(
      `DELETE FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    const deletedAttendances = getStatementChanges();
    db.run(
      `DELETE FROM stock_wallets WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    const deletedWallets = getStatementChanges();
    db.run("COMMIT");
    return {
      deletedWallets,
      deletedHoldings,
      deletedTrades,
      deletedAttendances,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

/** 길드 전체 모의투자 데이터 삭제 (거래 → 보유 → 출석 → 지갑 순). */
export function resetStockGuildData(guildId: string): StockResetCounts {
  db.run("BEGIN IMMEDIATE");
  try {
    db.run(`DELETE FROM stock_trades WHERE guild_id = ?`, [guildId]);
    const deletedTrades = getStatementChanges();
    db.run(`DELETE FROM stock_holdings WHERE guild_id = ?`, [guildId]);
    const deletedHoldings = getStatementChanges();
    db.run(`DELETE FROM stock_daily_attendance WHERE guild_id = ?`, [
      guildId,
    ]);
    const deletedAttendances = getStatementChanges();
    db.run(`DELETE FROM stock_wallets WHERE guild_id = ?`, [guildId]);
    const deletedWallets = getStatementChanges();
    db.run("COMMIT");
    return {
      deletedWallets,
      deletedHoldings,
      deletedTrades,
      deletedAttendances,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

function getSeasonRowById(id: number): SeasonRow | undefined {
  return db.get<SeasonRow>(
    `SELECT id, guild_id, name, status, started_at, ended_at, created_at
     FROM stock_seasons WHERE id = ?`,
    [id],
  );
}

export function getActiveStockSeason(guildId: string): StockSeason | null {
  const row = db.get<SeasonRow>(
    `SELECT id, guild_id, name, status, started_at, ended_at, created_at
     FROM stock_seasons WHERE guild_id = ? AND status = 'ACTIVE'`,
    [guildId],
  );
  return row ? mapSeason(row) : null;
}

export function createStockSeason(
  guildId: string,
  name: string,
): CreateStockSeasonResult {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    throw new StockStorageError("INVALID_SEASON_NAME");
  }
  if (getActiveStockSeason(guildId)) {
    throw new StockStorageError("ACTIVE_SEASON_EXISTS");
  }
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO stock_seasons (guild_id, name, status, started_at, ended_at, created_at)
     VALUES (?, ?, 'ACTIVE', ?, NULL, ?)`,
    [guildId, trimmed, now, now],
  );
  const idRow = db.get<{ id: number }>("SELECT last_insert_rowid() AS id");
  const id = Number(idRow?.id ?? 0);
  const row = getSeasonRowById(id);
  if (!row) {
    throw new Error("stock_seasons insert readback failed");
  }
  return mapSeason(row);
}

export function endActiveStockSeasonWithResults(
  guildId: string,
  rankingEntries: StockRankingEntry[],
): EndStockSeasonResult {
  if (rankingEntries.length === 0) {
    throw new StockStorageError("EMPTY_RANKING");
  }
  const active = getActiveStockSeason(guildId);
  if (!active) {
    throw new StockStorageError("ACTIVE_SEASON_NOT_FOUND");
  }
  const now = new Date().toISOString();
  db.run("BEGIN IMMEDIATE");
  try {
    let r = 1;
    for (const e of rankingEntries) {
      db.run(
        `INSERT INTO stock_season_results (
           season_id, guild_id, user_id, rank, total_assets, cash_balance,
           stock_value_total, profit_loss, profit_loss_percent, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          active.id,
          guildId,
          e.userId,
          r,
          e.totalAssets,
          e.cashBalance,
          e.stockValueTotal,
          e.profitLoss,
          e.profitLossPercent,
          now,
        ],
      );
      r += 1;
    }
    db.run(
      `UPDATE stock_seasons SET status = 'ENDED', ended_at = ? WHERE id = ?`,
      [now, active.id],
    );
    db.run("COMMIT");
    const endedRow = getSeasonRowById(active.id);
    if (!endedRow) {
      throw new Error("season row missing after end");
    }
    const season = mapSeason(endedRow);
    const savedResults = listStockSeasonResults(active.id);
    return { season, savedResults };
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

export function getLatestEndedStockSeason(guildId: string): StockSeason | null {
  const row = db.get<SeasonRow>(
    `SELECT id, guild_id, name, status, started_at, ended_at, created_at
     FROM stock_seasons
     WHERE guild_id = ? AND status = 'ENDED'
     ORDER BY ended_at DESC
     LIMIT 1`,
    [guildId],
  );
  return row ? mapSeason(row) : null;
}

export function listStockSeasonResults(seasonId: number): StockSeasonResult[] {
  const rows = db.all<SeasonResultRow>(
    `SELECT id, season_id, guild_id, user_id, rank, total_assets, cash_balance,
            stock_value_total, profit_loss, profit_loss_percent, created_at
     FROM stock_season_results WHERE season_id = ?
     ORDER BY rank ASC`,
    [seasonId],
  );
  return rows.map(mapSeasonResult);
}

interface CoinGameLogRow {
  id: number;
  guild_id: string;
  user_id: string;
  game_type: string;
  bet_amount: number;
  result: string;
  balance_delta: number;
  balance_after: number;
  metadata: string | null;
  created_at: string;
}

function clampCoinGameLogLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 10;
  }
  if (!Number.isInteger(limit)) {
    return 10;
  }
  return Math.min(20, Math.max(1, limit));
}

function parseCoinGameLogMetadata(
  raw: string | null,
): CoinGameLogMetadataParsed | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) {
      return null;
    }
    const o = v as Record<string, unknown>;
    const out: CoinGameLogMetadataParsed = {};
    if (typeof o.playerChoice === "string") {
      out.playerChoice = o.playerChoice;
    }
    if (typeof o.botChoice === "string") {
      out.botChoice = o.botChoice;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

function mapCoinGameLogRow(row: CoinGameLogRow): CoinGameLogEntry {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    gameType: row.game_type,
    betAmount: Number(row.bet_amount),
    result: row.result,
    balanceDelta: Number(row.balance_delta),
    balanceAfter: Number(row.balance_after),
    metadata: parseCoinGameLogMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

/** `coin_game_logs` 최근 기록 (기본 10건, 최대 20건). */
export function listCoinGameLogs(
  params: ListCoinGameLogsParams,
): CoinGameLogEntry[] {
  const limit = clampCoinGameLogLimit(params.limit);
  const args: unknown[] = [params.guildId];
  let sql = `SELECT id, guild_id, user_id, game_type, bet_amount, result,
       balance_delta, balance_after, metadata, created_at
     FROM coin_game_logs
     WHERE guild_id = ?`;

  if (params.userId !== undefined && params.userId !== "") {
    sql += ` AND user_id = ?`;
    args.push(params.userId);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(limit);

  const rows = db.all<CoinGameLogRow>(sql, args);
  return rows.map(mapCoinGameLogRow);
}

export function countCoinInventoryItems(
  guildId: string,
  userId: string,
): number {
  const row = db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId],
  );
  return Number(row?.n ?? 0);
}

export function getLatestCoinGameLog(
  guildId: string,
  userId: string,
): CoinGameLogEntry | null {
  const rows = listCoinGameLogs({ guildId, userId, limit: 1 });
  return rows[0] ?? null;
}

export function getCoinProfileSummary(
  guildId: string,
  userId: string,
  prices: StockPrice[],
): CoinProfileSummary {
  const wallet = getStockWallet(guildId, userId);
  const assetSummary = getStockAssetSummary(guildId, userId, prices);
  const equippedTitle = getEquippedTitleDisplayName(guildId, userId);
  const inventoryCount = countCoinInventoryItems(guildId, userId);
  const latestGameLog = getLatestCoinGameLog(guildId, userId);
  const activeSeason = getActiveStockSeason(guildId);
  return {
    wallet,
    assetSummary,
    equippedTitle,
    inventoryCount,
    latestGameLog,
    activeSeason,
  };
}

interface CoinWorkLogDbRow {
  id: number;
  guild_id: string;
  user_id: string;
  reward_amount: number;
  balance_after: number;
  work_type: string;
  created_at: string;
}

const COIN_WORK_TYPE_PART_TIME = "PART_TIME";

const COIN_WORK_COOLDOWN_MS = DEFAULT_WORK_COOLDOWN_SECONDS * 1000;

function mapCoinWorkLatest(row: CoinWorkLogDbRow): CoinWorkLogLatest {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    rewardAmount: Number(row.reward_amount),
    balanceAfter: Number(row.balance_after),
    workType: row.work_type,
    createdAt: row.created_at,
  };
}

/** 최근 `/알바` 기록 1건 */
export interface CoinWorkLogLatest {
  id: number;
  guildId: string;
  userId: string;
  rewardAmount: number;
  balanceAfter: number;
  workType: string;
  createdAt: string;
}

export function getLatestCoinWorkLog(
  guildId: string,
  userId: string,
): CoinWorkLogLatest | null {
  const row = db.get<CoinWorkLogDbRow>(
    `SELECT id, guild_id, user_id, reward_amount, balance_after, work_type, created_at
     FROM coin_work_logs
     WHERE guild_id = ? AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [guildId, userId],
  );
  return row ? mapCoinWorkLatest(row) : null;
}

export function canWorkNow(
  guildId: string,
  userId: string,
  now: Date = new Date(),
): CoinWorkCooldownResult {
  const latest = getLatestCoinWorkLog(guildId, userId);
  if (!latest) {
    return { canWork: true, remainingMs: 0, latestWorkedAt: null };
  }
  const lastMs = new Date(latest.createdAt).getTime();
  const elapsed = now.getTime() - lastMs;
  if (elapsed >= COIN_WORK_COOLDOWN_MS) {
    return {
      canWork: true,
      remainingMs: 0,
      latestWorkedAt: latest.createdAt,
    };
  }
  return {
    canWork: false,
    remainingMs: COIN_WORK_COOLDOWN_MS - elapsed,
    latestWorkedAt: latest.createdAt,
  };
}

/** `/알바` — cash·total_deposit 증가, `coin_work_logs` 기록. */
export function performCoinWork(
  guildId: string,
  userId: string,
): CoinWorkResult {
  db.run("BEGIN IMMEDIATE");
  try {
    const latest = db.get<CoinWorkLogDbRow>(
      `SELECT id, guild_id, user_id, reward_amount, balance_after, work_type, created_at
       FROM coin_work_logs
       WHERE guild_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [guildId, userId],
    );
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    if (latest) {
      const lastMs = new Date(latest.created_at).getTime();
      if (nowDate.getTime() - lastMs < COIN_WORK_COOLDOWN_MS) {
        throw new StockStorageError("WORK_COOLDOWN");
      }
    }

    const reward = randomInt(MIN_WORK_REWARD, MAX_WORK_REWARD);
    ensureWalletRow(guildId, userId, nowIso);
    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance + ?, total_deposit = total_deposit + ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [reward, reward, nowIso, guildId, userId],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("coin work wallet update failed");
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);
    db.run(
      `INSERT INTO coin_work_logs (guild_id, user_id, reward_amount, balance_after, work_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        userId,
        reward,
        balanceAfter,
        COIN_WORK_TYPE_PART_TIME,
        nowIso,
      ],
    );
    db.run("COMMIT");
    return {
      rewardAmount: reward,
      balanceAfter,
      workType: COIN_WORK_TYPE_PART_TIME,
      createdAt: nowIso,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

interface CoinFishingLogDbRow {
  id: number;
  guild_id: string;
  user_id: string;
  fish_name: string;
  rarity: string;
  reward_amount: number;
  balance_after: number;
  created_at: string;
}

const COIN_FISHING_COOLDOWN_MS = DEFAULT_FISHING_COOLDOWN_SECONDS * 1000;

function mapCoinFishingLog(row: CoinFishingLogDbRow): CoinFishingLog {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    fishName: row.fish_name,
    rarity: row.rarity as FishingRarity,
    rewardAmount: Number(row.reward_amount),
    balanceAfter: Number(row.balance_after),
    createdAt: row.created_at,
  };
}

/** 최근 `/낚시` 기록 1건 */
export function getLatestCoinFishingLog(
  guildId: string,
  userId: string,
): CoinFishingLog | null {
  const row = db.get<CoinFishingLogDbRow>(
    `SELECT id, guild_id, user_id, fish_name, rarity, reward_amount, balance_after, created_at
     FROM coin_fishing_logs
     WHERE guild_id = ? AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [guildId, userId],
  );
  return row ? mapCoinFishingLog(row) : null;
}

export function canFishNow(
  guildId: string,
  userId: string,
  now: Date = new Date(),
): CoinFishingCooldownResult {
  const latest = getLatestCoinFishingLog(guildId, userId);
  if (!latest) {
    return { canFish: true, remainingMs: 0, latestFishedAt: null };
  }
  const lastMs = new Date(latest.createdAt).getTime();
  const elapsed = now.getTime() - lastMs;
  if (elapsed >= COIN_FISHING_COOLDOWN_MS) {
    return {
      canFish: true,
      remainingMs: 0,
      latestFishedAt: latest.createdAt,
    };
  }
  return {
    canFish: false,
    remainingMs: COIN_FISHING_COOLDOWN_MS - elapsed,
    latestFishedAt: latest.createdAt,
  };
}

function rollFishingReward(): {
  fishName: string;
  rarity: FishingRarity;
  rewardAmount: number;
} {
  const roll = randomInt(1, 100);
  if (roll <= 20) {
    return {
      fishName: "꽝",
      rarity: FISHING_RARITY_NONE,
      rewardAmount: 0,
    };
  }
  if (roll <= 55) {
    return {
      fishName: "작은 물고기",
      rarity: FISHING_RARITY_COMMON,
      rewardAmount: randomInt(300, 800),
    };
  }
  if (roll <= 80) {
    return {
      fishName: "평범한 물고기",
      rarity: FISHING_RARITY_UNCOMMON,
      rewardAmount: randomInt(800, 1500),
    };
  }
  if (roll <= 95) {
    return {
      fishName: "큰 물고기",
      rarity: FISHING_RARITY_RARE,
      rewardAmount: randomInt(1500, 3000),
    };
  }
  return {
    fishName: "황금 물고기",
    rarity: FISHING_RARITY_LEGENDARY,
    rewardAmount: 5000,
  };
}

/** `/낚시` — `coin_fishing_logs` 기록. 꽝은 잔액·total_deposit 불변. */
export function performCoinFishing(
  guildId: string,
  userId: string,
): CoinFishingResult {
  db.run("BEGIN IMMEDIATE");
  try {
    const latest = db.get<CoinFishingLogDbRow>(
      `SELECT id, guild_id, user_id, fish_name, rarity, reward_amount, balance_after, created_at
       FROM coin_fishing_logs
       WHERE guild_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [guildId, userId],
    );
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    if (latest) {
      const lastMs = new Date(latest.created_at).getTime();
      if (nowDate.getTime() - lastMs < COIN_FISHING_COOLDOWN_MS) {
        throw new StockStorageError("FISHING_COOLDOWN");
      }
    }

    const rolled = rollFishingReward();
    ensureWalletRow(guildId, userId, nowIso);
    const rewardAmount = rolled.rewardAmount;
    if (rewardAmount > 0) {
      db.run(
        `UPDATE stock_wallets SET cash_balance = cash_balance + ?, total_deposit = total_deposit + ?, updated_at = ?
         WHERE guild_id = ? AND user_id = ?`,
        [rewardAmount, rewardAmount, nowIso, guildId, userId],
      );
      if (getStatementChanges() !== 1) {
        throw new Error("coin fishing wallet update failed");
      }
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);
    db.run(
      `INSERT INTO coin_fishing_logs (guild_id, user_id, fish_name, rarity, reward_amount, balance_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        userId,
        rolled.fishName,
        rolled.rarity,
        rewardAmount,
        balanceAfter,
        nowIso,
      ],
    );
    db.run("COMMIT");
    return {
      fishName: rolled.fishName,
      rarity: rolled.rarity,
      rewardAmount,
      balanceAfter,
      createdAt: nowIso,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

const DAILY_MISSION_DISPLAY_ORDER: readonly {
  key: DailyMissionKey;
  label: string;
}[] = [
  { key: DAILY_MISSION_KEY_ATTENDANCE, label: "출석하기" },
  { key: DAILY_MISSION_KEY_WORK, label: "알바 1회 하기" },
  { key: DAILY_MISSION_KEY_FISHING, label: "낚시 1회 하기" },
  { key: DAILY_MISSION_KEY_RPS, label: "가위바위보 1회 하기" },
  { key: DAILY_MISSION_KEY_STOCK_LIST, label: "주식목록 확인하기" },
];

function hasDailyMissionRow(
  guildId: string,
  userId: string,
  date: string,
  missionKey: DailyMissionKey,
): boolean {
  const row = db.get<{ n: number }>(
    `SELECT 1 AS n FROM coin_daily_missions WHERE guild_id = ? AND user_id = ? AND date = ? AND mission_key = ? LIMIT 1`,
    [guildId, userId, date, missionKey],
  );
  return row !== undefined;
}

function hasAttendanceToday(
  guildId: string,
  userId: string,
  kstDate: string,
): boolean {
  const row = db.get<{ n: number }>(
    `SELECT 1 AS n FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ? AND date = ? LIMIT 1`,
    [guildId, userId, kstDate],
  );
  return row !== undefined;
}

function hasWorkOnKstDate(
  guildId: string,
  userId: string,
  kstDate: string,
): boolean {
  const { startIso, endExclusiveIso } = getKstDayUtcIsoBounds(kstDate);
  const row = db.get<{ n: number }>(
    `SELECT 1 AS n FROM coin_work_logs WHERE guild_id = ? AND user_id = ? AND created_at >= ? AND created_at < ? LIMIT 1`,
    [guildId, userId, startIso, endExclusiveIso],
  );
  return row !== undefined;
}

function hasFishingOnKstDate(
  guildId: string,
  userId: string,
  kstDate: string,
): boolean {
  const { startIso, endExclusiveIso } = getKstDayUtcIsoBounds(kstDate);
  const row = db.get<{ n: number }>(
    `SELECT 1 AS n FROM coin_fishing_logs WHERE guild_id = ? AND user_id = ? AND created_at >= ? AND created_at < ? LIMIT 1`,
    [guildId, userId, startIso, endExclusiveIso],
  );
  return row !== undefined;
}

function hasRpsOnKstDate(
  guildId: string,
  userId: string,
  kstDate: string,
): boolean {
  const { startIso, endExclusiveIso } = getKstDayUtcIsoBounds(kstDate);
  const row = db.get<{ n: number }>(
    `SELECT 1 AS n FROM coin_game_logs WHERE guild_id = ? AND user_id = ? AND game_type = 'RPS' AND created_at >= ? AND created_at < ? LIMIT 1`,
    [guildId, userId, startIso, endExclusiveIso],
  );
  return row !== undefined;
}

function isDailyMissionKeyComplete(
  guildId: string,
  userId: string,
  date: string,
  missionKey: DailyMissionKey,
): boolean {
  if (hasDailyMissionRow(guildId, userId, date, missionKey)) {
    return true;
  }
  switch (missionKey) {
    case DAILY_MISSION_KEY_ATTENDANCE:
      return hasAttendanceToday(guildId, userId, date);
    case DAILY_MISSION_KEY_WORK:
      return hasWorkOnKstDate(guildId, userId, date);
    case DAILY_MISSION_KEY_FISHING:
      return hasFishingOnKstDate(guildId, userId, date);
    case DAILY_MISSION_KEY_RPS:
      return hasRpsOnKstDate(guildId, userId, date);
    case DAILY_MISSION_KEY_STOCK_LIST:
      return false;
  }
}

/** `coin_daily_missions`에 기록. 실패해도 예외를 밖으로 던지지 않는다. */
export function recordDailyMissionProgress(
  guildId: string,
  userId: string,
  date: string,
  missionKey: DailyMissionKey,
): void {
  const nowIso = new Date().toISOString();
  try {
    db.run(
      `INSERT OR IGNORE INTO coin_daily_missions (guild_id, user_id, date, mission_key, completed_at) VALUES (?, ?, ?, ?, ?)`,
      [guildId, userId, date, missionKey, nowIso],
    );
  } catch (e) {
    log("error", "dailyMission", "recordDailyMissionProgress failed", e);
  }
}

export function getDailyMissionSummary(
  guildId: string,
  userId: string,
  date: string,
): DailyMissionSummary {
  const rewardRow = db.get<{ reward_amount: number }>(
    `SELECT reward_amount FROM coin_daily_mission_rewards WHERE guild_id = ? AND user_id = ? AND date = ?`,
    [guildId, userId, date],
  );
  const missions: DailyMissionStatus[] = DAILY_MISSION_DISPLAY_ORDER.map(
    ({ key, label }) => ({
      key,
      label,
      completed: isDailyMissionKeyComplete(guildId, userId, date, key),
    }),
  );
  const completedCount = missions.filter((m) => m.completed).length;
  return {
    date,
    missions,
    completedCount,
    totalCount: DAILY_MISSION_DISPLAY_ORDER.length,
    rewardClaimed: rewardRow !== undefined,
    rewardAmount: DAILY_MISSION_REWARD,
  };
}

export function claimDailyMissionReward(
  guildId: string,
  userId: string,
  date: string,
): { rewardAmount: number; balanceAfter: number } {
  db.run("BEGIN IMMEDIATE");
  try {
    const claimed = db.get<{ guild_id: string }>(
      `SELECT guild_id FROM coin_daily_mission_rewards WHERE guild_id = ? AND user_id = ? AND date = ?`,
      [guildId, userId, date],
    );
    if (claimed) {
      throw new StockStorageError("DAILY_MISSION_REWARD_ALREADY_CLAIMED");
    }
    for (const { key } of DAILY_MISSION_DISPLAY_ORDER) {
      if (!isDailyMissionKeyComplete(guildId, userId, date, key)) {
        throw new StockStorageError("DAILY_MISSION_NOT_COMPLETED");
      }
    }
    const nowIso = new Date().toISOString();
    const rewardAmount = DAILY_MISSION_REWARD;
    ensureWalletRow(guildId, userId, nowIso);
    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance + ?, total_deposit = total_deposit + ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [rewardAmount, rewardAmount, nowIso, guildId, userId],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("daily mission reward wallet update failed");
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);
    db.run(
      `INSERT INTO coin_daily_mission_rewards (guild_id, user_id, date, reward_amount, claimed_at) VALUES (?, ?, ?, ?, ?)`,
      [guildId, userId, date, rewardAmount, nowIso],
    );
    db.run("COMMIT");
    return { rewardAmount, balanceAfter };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

interface CoinInventoryRow {
  guild_id: string;
  user_id: string;
  item_key: string;
  item_type: string;
  item_name: string;
  price_paid: number;
  purchased_at: string;
}

function mapCoinInventoryRow(row: CoinInventoryRow): CoinInventoryItem {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    itemKey: row.item_key,
    itemType: row.item_type,
    itemName: row.item_name,
    pricePaid: Number(row.price_paid),
    purchasedAt: row.purchased_at,
  };
}

export function listCoinInventoryItems(
  guildId: string,
  userId: string,
): CoinInventoryItem[] {
  const rows = db.all<CoinInventoryRow>(
    `SELECT guild_id, user_id, item_key, item_type, item_name, price_paid, purchased_at
     FROM coin_inventory_items
     WHERE guild_id = ? AND user_id = ?
     ORDER BY purchased_at DESC`,
    [guildId, userId],
  );
  return rows.map(mapCoinInventoryRow);
}

export function hasCoinInventoryItem(
  guildId: string,
  userId: string,
  itemKey: string,
): boolean {
  const row = db.get<{ n: number }>(
    `SELECT 1 AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_key = ? LIMIT 1`,
    [guildId, userId, itemKey],
  );
  return row !== undefined;
}

/** 상점 구매 — `cash_balance`만 차감, `total_deposit`는 변경하지 않는다. */
export function purchaseCoinShopItem(params: {
  guildId: string;
  userId: string;
  item: CoinShopItem;
}): PurchaseCoinShopItemResult {
  const { guildId, userId, item } = params;
  const catalog = getCoinShopItems().find((i) => i.itemKey === item.itemKey);
  if (
    !catalog ||
    catalog.price !== item.price ||
    catalog.itemType !== item.itemType ||
    catalog.name !== item.name
  ) {
    throw new StockStorageError("ITEM_NOT_FOUND");
  }

  db.run("BEGIN IMMEDIATE");
  try {
    const walletRow = getWalletRow(guildId, userId);
    if (!walletRow) {
      throw new StockStorageError("WALLET_NOT_FOUND");
    }
    const owned = db.get<{ n: number }>(
      `SELECT 1 AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_key = ? LIMIT 1`,
      [guildId, userId, item.itemKey],
    );
    if (owned) {
      throw new StockStorageError("ITEM_ALREADY_OWNED");
    }
    const cash = Number(walletRow.cash_balance);
    if (cash < item.price) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }
    const nowIso = new Date().toISOString();
    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance - ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [item.price, nowIso, guildId, userId],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("coin shop wallet update failed");
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);
    db.run(
      `INSERT INTO coin_inventory_items (guild_id, user_id, item_key, item_type, item_name, price_paid, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        userId,
        catalog.itemKey,
        catalog.itemType,
        catalog.name,
        catalog.price,
        nowIso,
      ],
    );
    db.run("COMMIT");
    return { item: catalog, wallet: mapWallet(w), balanceAfter };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

const COIN_EQUIP_TYPE_TITLE = "TITLE";

interface CoinEquippedRow {
  guild_id: string;
  user_id: string;
  item_type: string;
  item_key: string;
  equipped_at: string;
}

function mapCoinEquippedRow(row: CoinEquippedRow): CoinEquippedItem {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    itemType: row.item_type,
    itemKey: row.item_key,
    equippedAt: row.equipped_at,
  };
}

export function getEquippedCoinItem(
  guildId: string,
  userId: string,
  itemType: string,
): CoinEquippedItem | null {
  const row = db.get<CoinEquippedRow>(
    `SELECT guild_id, user_id, item_type, item_key, equipped_at
     FROM coin_equipped_items
     WHERE guild_id = ? AND user_id = ? AND item_type = ?`,
    [guildId, userId, itemType],
  );
  return row ? mapCoinEquippedRow(row) : null;
}

export function getEquippedTitleDisplayName(
  guildId: string,
  userId: string,
): string | null {
  const eq = getEquippedCoinItem(guildId, userId, COIN_EQUIP_TYPE_TITLE);
  if (!eq) {
    return null;
  }
  const inv = db.get<{ item_name: string }>(
    `SELECT item_name FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_key = ? LIMIT 1`,
    [guildId, userId, eq.itemKey],
  );
  if (inv) {
    return inv.item_name;
  }
  return getCoinShopItems().find((i) => i.itemKey === eq.itemKey)?.name ?? null;
}

export interface EquipCoinInventoryItemResult {
  itemKey: string;
  itemType: string;
  itemName: string;
  equippedAt: string;
}

export function equipCoinInventoryItem(
  guildId: string,
  userId: string,
  itemKey: string,
): EquipCoinInventoryItemResult {
  const catalog = getCoinShopItems().find((i) => i.itemKey === itemKey);
  if (!catalog) {
    throw new StockStorageError("ITEM_NOT_FOUND");
  }
  if (catalog.itemType !== COIN_EQUIP_TYPE_TITLE) {
    throw new StockStorageError("INVALID_ITEM_TYPE");
  }

  db.run("BEGIN IMMEDIATE");
  try {
    const inv = db.get<{ n: number }>(
      `SELECT 1 AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_key = ? LIMIT 1`,
      [guildId, userId, itemKey],
    );
    if (!inv) {
      throw new StockStorageError("ITEM_NOT_OWNED");
    }
    const nowIso = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO coin_equipped_items (guild_id, user_id, item_type, item_key, equipped_at)
       VALUES (?, ?, ?, ?, ?)`,
      [guildId, userId, COIN_EQUIP_TYPE_TITLE, itemKey, nowIso],
    );
    db.run("COMMIT");
    return {
      itemKey: catalog.itemKey,
      itemType: catalog.itemType,
      itemName: catalog.name,
      equippedAt: nowIso,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

export function unequipCoinItem(
  guildId: string,
  userId: string,
  itemType: string,
): { deleted: boolean } {
  db.run(
    `DELETE FROM coin_equipped_items WHERE guild_id = ? AND user_id = ? AND item_type = ?`,
    [guildId, userId, itemType],
  );
  return { deleted: getStatementChanges() > 0 };
}

export function parseRpsChoice(raw: string): RpsChoice | null {
  const t = raw.trim();
  if (t === "가위" || t === "바위" || t === "보") {
    return t;
  }
  return null;
}

const RPS_CHOICES: readonly RpsChoice[] = ["가위", "바위", "보"];

function validateRpsBet(amount: number, minBet: number, maxBet: number): void {
  if (
    !Number.isInteger(amount) ||
    amount < minBet ||
    amount > maxBet
  ) {
    throw new StockStorageError("INVALID_AMOUNT");
  }
}

function compareRps(player: RpsChoice, bot: RpsChoice): RpsResult {
  if (player === bot) {
    return "DRAW";
  }
  if (
    (player === "가위" && bot === "보") ||
    (player === "바위" && bot === "가위") ||
    (player === "보" && bot === "바위")
  ) {
    return "WIN";
  }
  return "LOSE";
}

/** 가상 코인 가위바위보 — total_deposit은 변경하지 않는다. */
export function playRockPaperScissors(
  params: PlayRockPaperScissorsParams,
): PlayRockPaperScissorsResult {
  const { guildId, userId, playerChoice, betAmount, rpsMinBet, rpsMaxBet } =
    params;
  validateRpsBet(betAmount, rpsMinBet, rpsMaxBet);

  db.run("BEGIN IMMEDIATE");
  try {
    const row = getWalletRow(guildId, userId);
    if (!row) {
      db.run("ROLLBACK");
      throw new StockStorageError("WALLET_NOT_FOUND");
    }
    const cash = Number(row.cash_balance);
    if (cash < betAmount) {
      db.run("ROLLBACK");
      throw new StockStorageError("INSUFFICIENT_CASH");
    }

    const botChoice = RPS_CHOICES[randomInt(0, RPS_CHOICES.length - 1)]!;
    const rpsResult = compareRps(playerChoice, botChoice);
    const now = new Date().toISOString();

    let balanceDelta = 0;
    if (rpsResult === "WIN") {
      balanceDelta = betAmount;
      db.run(
        `UPDATE stock_wallets SET cash_balance = cash_balance + ?, updated_at = ?
         WHERE guild_id = ? AND user_id = ?`,
        [betAmount, now, guildId, userId],
      );
      if (getStatementChanges() !== 1) {
        db.run("ROLLBACK");
        throw new Error("rps win wallet update failed");
      }
    } else if (rpsResult === "LOSE") {
      balanceDelta = -betAmount;
      db.run(
        `UPDATE stock_wallets SET cash_balance = cash_balance - ?, updated_at = ?
         WHERE guild_id = ? AND user_id = ? AND cash_balance >= ?`,
        [betAmount, now, guildId, userId, betAmount],
      );
      if (getStatementChanges() !== 1) {
        db.run("ROLLBACK");
        throw new StockStorageError("INSUFFICIENT_CASH");
      }
    } else {
      balanceDelta = 0;
    }

    const afterRow = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(afterRow.cash_balance);
    const metaJson = JSON.stringify({ playerChoice, botChoice });

    db.run(
      `INSERT INTO coin_game_logs (
         guild_id, user_id, game_type, bet_amount, result, balance_delta, balance_after, metadata, created_at
       ) VALUES (?, ?, 'RPS', ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        userId,
        betAmount,
        rpsResult,
        balanceDelta,
        balanceAfter,
        metaJson,
        now,
      ],
    );

    const logId = Number(
      db.get<{ id: number }>("SELECT last_insert_rowid() AS id")?.id ?? 0,
    );

    db.run("COMMIT");

    return {
      playerChoice,
      botChoice,
      result: rpsResult,
      betAmount,
      balanceDelta,
      balanceAfter,
      logId,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}
