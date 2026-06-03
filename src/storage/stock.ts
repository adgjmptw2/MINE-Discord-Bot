import { randomInt } from "node:crypto";
import { db } from "@/storage/db";
import type { StockPrice } from "@/services/stock/types";
import { getCoinShopItems, type CoinShopItem } from "@/settings/coinShopItems";
import {
  getCoinAchievements,
  type CoinAchievement,
  type CoinAchievementCategory,
} from "@/settings/coinAchievements";
import {
  addKstCalendarDays,
  getKstMonthCalendarBounds,
  getKstDayUtcIsoBounds,
} from "@/utils/date";
import { log } from "@/utils/logger";

export const STOCK_QUANTITY_SCALE = 1_000_000;

export const MIN_STOCK_BUY_AMOUNT = 1_000;

export const MIN_STOCK_SELL_AMOUNT = 1_000;

export const DEFAULT_ATTENDANCE_REWARD = 10_000;
export const DEFAULT_RPS_MIN_BET = 100;
export const DEFAULT_RPS_MAX_BET = 100_000;
export const DEFAULT_RPS_COOLDOWN_SECONDS = 5;

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

export interface StockResetCounts {
  deletedWallets: number;
  deletedHoldings: number;
  deletedTrades: number;
  deletedAttendances: number;
  deletedSwords: number;
  deletedDungeonRuns: number;
  deletedConsumables: number;
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

export const MIN_RPS_BET = DEFAULT_RPS_MIN_BET;
export const MAX_RPS_BET = DEFAULT_RPS_MAX_BET;

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
  consumableQuantityAfter?: number;
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

export interface CoinAchievementStatus {
  key: string;
  name: string;
  description: string;
  rewardAmount: number;
  category: CoinAchievementCategory;
  completed: boolean;
  claimed: boolean;
}

export interface CoinAchievementSummary {
  achievements: CoinAchievementStatus[];
  completedCount: number;
  claimedCount: number;
  totalCount: number;
}

export interface ClaimCoinAchievementRewardResult {
  achievement: CoinAchievement;
  rewardAmount: number;
  balanceAfter: number;
}

export interface ClaimAllCoinAchievementRewardsResult {
  claimedAchievementKeys: string[];
  totalReward: number;
  balanceAfter: number;
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
  | "INVALID_ITEM_TYPE"
  | "ACHIEVEMENT_NOT_FOUND"
  | "ACHIEVEMENT_NOT_COMPLETED"
  | "ACHIEVEMENT_ALREADY_CLAIMED"
  | "ACHIEVEMENT_REWARD_NOT_AVAILABLE"
  | "SWORD_MAX_LEVEL"
  | "INVALID_SWORD_LEVEL"
  | "INSUFFICIENT_ITEM_QUANTITY";

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
  buyFeeRate: number;
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
  sellFeeRate: number;
  sellTaxRate: number;
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
  sellFee: number;
  sellTax: number;
  totalFee: number;
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

const ATTENDANCE_STREAK_BONUS_7 = 3_000;
const ATTENDANCE_STREAK_BONUS_14 = 5_000;
const ATTENDANCE_STREAK_BONUS_30 = 10_000;

function streakBonusForConsecutiveDays(streak: number): number {
  if (streak === 7) return ATTENDANCE_STREAK_BONUS_7;
  if (streak === 14) return ATTENDANCE_STREAK_BONUS_14;
  if (streak === 30) return ATTENDANCE_STREAK_BONUS_30;
  return 0;
}

function hasStockAttendance(
  guildId: string,
  userId: string,
  date: string,
): boolean {
  const r = db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ? AND date = ?`,
    [guildId, userId, date],
  );
  return Number(r?.n ?? 0) > 0;
}

export function computeAttendanceStreak(
  guildId: string,
  userId: string,
  asOfDate: string,
): number {
  if (hasStockAttendance(guildId, userId, asOfDate)) {
    let count = 0;
    let d = asOfDate;
    while (hasStockAttendance(guildId, userId, d)) {
      count++;
      d = addKstCalendarDays(d, -1);
    }
    return count;
  }
  let count = 0;
  let d = addKstCalendarDays(asOfDate, -1);
  while (hasStockAttendance(guildId, userId, d)) {
    count++;
    d = addKstCalendarDays(d, -1);
  }
  return count;
}

export function listStockAttendanceDatesInMonth(
  guildId: string,
  userId: string,
  kstNow: Date = new Date(),
): string[] {
  const { firstYmd, lastYmd } = getKstMonthCalendarBounds(kstNow);
  const rows = db.all<{ date: string }>(
    `SELECT date FROM stock_daily_attendance
     WHERE guild_id = ? AND user_id = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`,
    [guildId, userId, firstYmd, lastYmd],
  );
  return rows.map((r) => r.date);
}

export interface RecordStockAttendanceResult {
  alreadyClaimed: boolean;
  wallet: StockWallet;
  rewardAmount: number;
  streakDays: number;
  streakBonusAmount: number;
}

export function recordStockAttendance(
  guildId: string,
  userId: string,
  date: string,
  rewardAmount = DAILY_ATTENDANCE_REWARD,
): RecordStockAttendanceResult {
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
      const streakDays = computeAttendanceStreak(guildId, userId, date);
      db.run("COMMIT");
      return {
        alreadyClaimed: true,
        wallet: mapWallet(w),
        rewardAmount,
        streakDays,
        streakBonusAmount: 0,
      };
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

    const streakDays = computeAttendanceStreak(guildId, userId, date);
    const streakBonusAmount = streakBonusForConsecutiveDays(streakDays);
    if (streakBonusAmount > 0) {
      db.run(
        `UPDATE stock_wallets
         SET cash_balance = cash_balance + ?,
             total_deposit = total_deposit + ?,
             updated_at = ?
         WHERE guild_id = ? AND user_id = ?`,
        [streakBonusAmount, streakBonusAmount, now, guildId, userId],
      );
    }

    const updated = getWalletRow(guildId, userId)!;
    db.run("COMMIT");
    return {
      alreadyClaimed: false,
      wallet: mapWallet(updated),
      rewardAmount,
      streakDays,
      streakBonusAmount,
    };
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

// 랭킹: 총자산 0 제외
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
  const fee = Math.floor(amount * params.buyFeeRate);
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
    const sellFee = Math.floor(grossAmount * params.sellFeeRate);
    const sellTax = Math.floor(grossAmount * params.sellTaxRate);
    const totalFee = sellFee + sellTax;
    const netAmount = grossAmount - totalFee;
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
        totalFee,
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
      fee: totalFee,
      sellFee,
      sellTax,
      totalFee,
      netAmount,
      realizedProfit,
      averageBuyPrice: avgBuy,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

// 관리자 지급·차감 상한
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
      `DELETE FROM coin_dungeon_runs WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    const deletedDungeonRuns = getStatementChanges();
    db.run(
      `DELETE FROM coin_consumable_items WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    const deletedConsumables = getStatementChanges();
    db.run(`DELETE FROM coin_swords WHERE guild_id = ? AND user_id = ?`, [
      guildId,
      userId,
    ]);
    const deletedSwords = getStatementChanges();
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
      deletedSwords,
      deletedDungeonRuns,
      deletedConsumables,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

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
    db.run(`DELETE FROM coin_dungeon_runs WHERE guild_id = ?`, [guildId]);
    const deletedDungeonRuns = getStatementChanges();
    db.run(`DELETE FROM coin_consumable_items WHERE guild_id = ?`, [
      guildId,
    ]);
    const deletedConsumables = getStatementChanges();
    db.run(`DELETE FROM coin_swords WHERE guild_id = ?`, [guildId]);
    const deletedSwords = getStatementChanges();
    db.run(`DELETE FROM stock_wallets WHERE guild_id = ?`, [guildId]);
    const deletedWallets = getStatementChanges();
    db.run("COMMIT");
    return {
      deletedWallets,
      deletedHoldings,
      deletedTrades,
      deletedAttendances,
      deletedSwords,
      deletedDungeonRuns,
      deletedConsumables,
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

function coinAchievementRowCount(sql: string, guildId: string, userId: string): number {
  const row = db.get<{ n: number }>(sql, [guildId, userId]);
  return Number(row?.n ?? 0);
}

function getCoinSwordStatsForAchievement(
  guildId: string,
  userId: string,
): { totalAttempts: number; highestLevel: number } | null {
  const row = db.get<{
    total_attempts: number;
    highest_level: number;
  }>(
    `SELECT total_attempts, highest_level FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId],
  );
  if (!row) {
    return null;
  }
  return {
    totalAttempts: Number(row.total_attempts),
    highestLevel: Number(row.highest_level),
  };
}

function isCoinAchievementCompleted(
  guildId: string,
  userId: string,
  achievementKey: string,
): boolean {
  switch (achievementKey) {
    case "first_attendance":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ? LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_work":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM coin_work_logs WHERE guild_id = ? AND user_id = ? LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_fishing":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM coin_fishing_logs WHERE guild_id = ? AND user_id = ? LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_rps":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM coin_game_logs WHERE guild_id = ? AND user_id = ? AND game_type = 'RPS' LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_rps_win":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM coin_game_logs WHERE guild_id = ? AND user_id = ? AND game_type = 'RPS' AND result = 'WIN' LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_stock_trade":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM stock_trades WHERE guild_id = ? AND user_id = ? LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_stock_buy":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM stock_trades WHERE guild_id = ? AND user_id = ? AND side = 'BUY' LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_stock_sell":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM stock_trades WHERE guild_id = ? AND user_id = ? AND side = 'SELL' LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_shop_purchase":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "first_title_equipped":
      return (
        db.get<{ n: number }>(
          `SELECT 1 AS n FROM coin_equipped_items WHERE guild_id = ? AND user_id = ? AND item_type = 'TITLE' LIMIT 1`,
          [guildId, userId],
        ) !== undefined
      );
    case "attendance_7":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 7
      );
    case "attendance_30":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM stock_daily_attendance WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 30
      );
    case "work_10":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_work_logs WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 10
      );
    case "fishing_10":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_fishing_logs WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 10
      );
    case "rps_20":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_game_logs WHERE guild_id = ? AND user_id = ? AND game_type = 'RPS'`,
          guildId,
          userId,
        ) >= 20
      );
    case "rps_win_10":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_game_logs WHERE guild_id = ? AND user_id = ? AND game_type = 'RPS' AND result = 'WIN'`,
          guildId,
          userId,
        ) >= 10
      );
    case "shop_title_1":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_type = 'TITLE'`,
          guildId,
          userId,
        ) >= 1
      );
    case "shop_title_3":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_type = 'TITLE'`,
          guildId,
          userId,
        ) >= 3
      );
    case "stock_trade_10":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM stock_trades WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 10
      );
    case "stock_diversified_3":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(DISTINCT symbol) AS n FROM stock_holdings WHERE guild_id = ? AND user_id = ? AND quantity_micro > 0`,
          guildId,
          userId,
        ) >= 3
      );
    case "sword_first_enhance": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.totalAttempts >= 1;
    }
    case "sword_level_5": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.highestLevel >= 5;
    }
    case "sword_level_10": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.highestLevel >= 10;
    }
    case "sword_level_12": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.highestLevel >= 12;
    }
    case "sword_level_15": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.highestLevel >= 15;
    }
    case "sword_level_18": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.highestLevel >= 18;
    }
    case "sword_level_20": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.highestLevel >= 20;
    }
    case "sword_attempt_100": {
      const s = getCoinSwordStatsForAchievement(guildId, userId);
      return s !== null && s.totalAttempts >= 100;
    }
    case "dungeon_run_7":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_dungeon_runs WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 7
      );
    case "dungeon_run_30":
      return (
        coinAchievementRowCount(
          `SELECT COUNT(*) AS n FROM coin_dungeon_runs WHERE guild_id = ? AND user_id = ?`,
          guildId,
          userId,
        ) >= 30
      );
    default:
      return false;
  }
}

function loadClaimedAchievementKeys(
  guildId: string,
  userId: string,
): Set<string> {
  const rows = db.all<{ achievement_key: string }>(
    `SELECT achievement_key FROM coin_achievement_rewards WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId],
  );
  return new Set(rows.map((r) => r.achievement_key));
}

export function getCoinAchievementSummary(
  guildId: string,
  userId: string,
): CoinAchievementSummary {
  const claimedKeys = loadClaimedAchievementKeys(guildId, userId);
  const defs = getCoinAchievements();
  const achievements: CoinAchievementStatus[] = defs.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    rewardAmount: def.rewardAmount,
    category: def.category,
    completed: isCoinAchievementCompleted(guildId, userId, def.key),
    claimed: claimedKeys.has(def.key),
  }));
  const completedCount = achievements.filter((a) => a.completed).length;
  const claimedCount = achievements.filter((a) => a.claimed).length;
  return {
    achievements,
    completedCount,
    claimedCount,
    totalCount: achievements.length,
  };
}

export function claimCoinAchievementReward(
  guildId: string,
  userId: string,
  achievementKey: string,
): ClaimCoinAchievementRewardResult {
  const def = getCoinAchievements().find((a) => a.key === achievementKey);
  if (!def) {
    throw new StockStorageError("ACHIEVEMENT_NOT_FOUND");
  }
  db.run("BEGIN IMMEDIATE");
  try {
    if (!isCoinAchievementCompleted(guildId, userId, achievementKey)) {
      throw new StockStorageError("ACHIEVEMENT_NOT_COMPLETED");
    }
    const already = db.get<{ guild_id: string }>(
      `SELECT guild_id FROM coin_achievement_rewards WHERE guild_id = ? AND user_id = ? AND achievement_key = ?`,
      [guildId, userId, achievementKey],
    );
    if (already) {
      throw new StockStorageError("ACHIEVEMENT_ALREADY_CLAIMED");
    }
    const nowIso = new Date().toISOString();
    const rewardAmount = def.rewardAmount;
    ensureWalletRow(guildId, userId, nowIso);
    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance + ?, total_deposit = total_deposit + ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [rewardAmount, rewardAmount, nowIso, guildId, userId],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("achievement reward wallet update failed");
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);
    db.run(
      `INSERT INTO coin_achievement_rewards (guild_id, user_id, achievement_key, reward_amount, claimed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [guildId, userId, achievementKey, rewardAmount, nowIso],
    );
    db.run("COMMIT");
    return { achievement: def, rewardAmount, balanceAfter };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

export function claimAllCompletedAchievementRewards(
  guildId: string,
  userId: string,
): ClaimAllCoinAchievementRewardsResult {
  db.run("BEGIN IMMEDIATE");
  try {
    const defs = getCoinAchievements();
    const keysToClaim: CoinAchievement[] = [];
    for (const def of defs) {
      if (!isCoinAchievementCompleted(guildId, userId, def.key)) {
        continue;
      }
      const already = db.get<{ guild_id: string }>(
        `SELECT guild_id FROM coin_achievement_rewards WHERE guild_id = ? AND user_id = ? AND achievement_key = ?`,
        [guildId, userId, def.key],
      );
      if (already) {
        continue;
      }
      keysToClaim.push(def);
    }
    if (keysToClaim.length === 0) {
      throw new StockStorageError("ACHIEVEMENT_REWARD_NOT_AVAILABLE");
    }
    const totalReward = keysToClaim.reduce((s, d) => s + d.rewardAmount, 0);
    const nowIso = new Date().toISOString();
    ensureWalletRow(guildId, userId, nowIso);
    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance + ?, total_deposit = total_deposit + ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [totalReward, totalReward, nowIso, guildId, userId],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("claim all achievement rewards wallet update failed");
    }
    for (const def of keysToClaim) {
      db.run(
        `INSERT INTO coin_achievement_rewards (guild_id, user_id, achievement_key, reward_amount, claimed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [guildId, userId, def.key, def.rewardAmount, nowIso],
      );
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);
    db.run("COMMIT");
    return {
      claimedAchievementKeys: keysToClaim.map((d) => d.key),
      totalReward,
      balanceAfter,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

export interface CoinSword {
  guildId: string;
  userId: string;
  level: number;
  totalAttempts: number;
  successCount: number;
  failCount: number;
  downgradeCount: number;
  destroyCount: number;
  highestLevel: number;
  lastEnhancedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CoinSwordRow {
  guild_id: string;
  user_id: string;
  level: number;
  total_attempts: number;
  success_count: number;
  fail_count: number;
  downgrade_count: number;
  destroy_count: number;
  highest_level: number;
  last_enhanced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapCoinSwordRow(row: CoinSwordRow): CoinSword {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    level: Number(row.level),
    totalAttempts: Number(row.total_attempts),
    successCount: Number(row.success_count),
    failCount: Number(row.fail_count),
    downgradeCount: Number(row.downgrade_count),
    destroyCount: Number(row.destroy_count),
    highestLevel: Number(row.highest_level),
    lastEnhancedAt: row.last_enhanced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getCoinSword(guildId: string, userId: string): CoinSword | null {
  const row = db.get<CoinSwordRow>(
    `SELECT guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at
     FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId],
  );
  return row ? mapCoinSwordRow(row) : null;
}

export function getOrCreateCoinSword(guildId: string, userId: string): CoinSword {
  const existing = getCoinSword(guildId, userId);
  if (existing) {
    return existing;
  }
  const nowIso = new Date().toISOString();
  db.run(
    `INSERT OR IGNORE INTO coin_swords (guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at)
     VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
    [guildId, userId, nowIso, nowIso],
  );
  const row = getCoinSword(guildId, userId);
  if (!row) {
    throw new Error("coin_sword_row_missing");
  }
  return row;
}

export const MAX_SWORD_LEVEL = 20;

export const SWORD_DESTROY_RESET_LEVEL = 10;

export const DOWNGRADE_PROTECTION_TICKET_KEY = "downgrade_protection_ticket";
export const DESTROY_PROTECTION_TICKET_KEY = "destroy_protection_ticket";

const SWORD_ENHANCE_TABLE: readonly {
  cost: number;
  success: number;
  downgrade: number;
  destroy: number;
}[] = [
  { cost: 1_000, success: 95, downgrade: 0, destroy: 0 },
  { cost: 1_500, success: 90, downgrade: 0, destroy: 0 },
  { cost: 2_000, success: 85, downgrade: 0, destroy: 0 },
  { cost: 3_000, success: 80, downgrade: 0, destroy: 0 },
  { cost: 4_000, success: 75, downgrade: 0, destroy: 0 },
  { cost: 6_000, success: 68, downgrade: 0, destroy: 0 },
  { cost: 8_000, success: 62, downgrade: 5, destroy: 0 },
  { cost: 10_000, success: 56, downgrade: 8, destroy: 0 },
  { cost: 12_000, success: 50, downgrade: 10, destroy: 0 },
  { cost: 15_000, success: 45, downgrade: 12, destroy: 0 },
  { cost: 20_000, success: 38, downgrade: 15, destroy: 0 },
  { cost: 27_000, success: 32, downgrade: 18, destroy: 1 },
  { cost: 35_000, success: 26, downgrade: 22, destroy: 2 },
  { cost: 45_000, success: 21, downgrade: 26, destroy: 3 },
  { cost: 60_000, success: 16, downgrade: 30, destroy: 4 },
  { cost: 80_000, success: 12, downgrade: 34, destroy: 6 },
  { cost: 110_000, success: 9, downgrade: 38, destroy: 8 },
  { cost: 150_000, success: 6, downgrade: 42, destroy: 10 },
  { cost: 220_000, success: 4, downgrade: 45, destroy: 13 },
  { cost: 350_000, success: 2, downgrade: 50, destroy: 16 },
] as const;

export type SwordEnhanceOutcome =
  | "SUCCESS"
  | "FAIL_KEEP"
  | "FAIL_DOWNGRADE"
  | "DESTROYED"
  | "FAIL_DOWNGRADE_PROTECTED"
  | "DESTROYED_PROTECTED";

export interface SwordEnhanceRate {
  level: number;
  cost: number;
  successPercent: number;
  downgradePercent: number;
  destroyPercent: number;
}

export interface EnhanceCoinSwordOptions {
  useDowngradeProtection?: boolean;
  useDestroyProtection?: boolean;
}

export interface EnhanceCoinSwordResult {
  outcome: SwordEnhanceOutcome;
  beforeLevel: number;
  afterLevel: number;
  highestLevel: number;
  cost: number;
  successPercent: number;
  downgradePercent: number;
  destroyPercent: number;
  wallet: StockWallet;
  sword: CoinSword;
  usedDowngradeProtection: boolean;
  usedDestroyProtection: boolean;
  selectedDowngradeProtection: boolean;
  selectedDestroyProtection: boolean;
}

export function getSwordEnhanceRate(level: number): SwordEnhanceRate | null {
  if (!Number.isInteger(level) || level < 0 || level > 19) {
    return null;
  }
  const row = SWORD_ENHANCE_TABLE[level]!;
  return {
    level,
    cost: row.cost,
    successPercent: row.success,
    downgradePercent: row.downgrade,
    destroyPercent: row.destroy,
  };
}

export function enhanceCoinSword(
  guildId: string,
  userId: string,
  options: EnhanceCoinSwordOptions = {},
): EnhanceCoinSwordResult {
  const useDowngradeProtection = Boolean(options.useDowngradeProtection);
  const useDestroyProtection = Boolean(options.useDestroyProtection);
  const nowIso = new Date().toISOString();
  db.run("BEGIN IMMEDIATE");
  try {
    const walletRow = getWalletRow(guildId, userId);
    if (!walletRow) {
      throw new StockStorageError("WALLET_NOT_FOUND");
    }

    let swordRow = db.get<CoinSwordRow>(
      `SELECT guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at
       FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    if (!swordRow) {
      db.run(
        `INSERT OR IGNORE INTO coin_swords (guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at)
         VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
        [guildId, userId, nowIso, nowIso],
      );
      swordRow = db.get<CoinSwordRow>(
        `SELECT guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at
         FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId],
      );
    }
    if (!swordRow) {
      throw new Error("coin_sword_row_missing");
    }

    const beforeLevel = Number(swordRow.level);
    const prevHighest = Number(swordRow.highest_level);
    if (beforeLevel >= MAX_SWORD_LEVEL) {
      throw new StockStorageError("SWORD_MAX_LEVEL");
    }

    const rate = getSwordEnhanceRate(beforeLevel);
    if (!rate) {
      throw new StockStorageError("INVALID_SWORD_LEVEL");
    }

    if (useDowngradeProtection) {
      const qRow = db.get<{ quantity: number }>(
        `SELECT quantity FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
        [guildId, userId, DOWNGRADE_PROTECTION_TICKET_KEY],
      );
      const q = qRow ? Number(qRow.quantity) : 0;
      if (q < 1) {
        throw new StockStorageError("INSUFFICIENT_ITEM_QUANTITY");
      }
    }
    if (useDestroyProtection) {
      const qRow = db.get<{ quantity: number }>(
        `SELECT quantity FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
        [guildId, userId, DESTROY_PROTECTION_TICKET_KEY],
      );
      const q = qRow ? Number(qRow.quantity) : 0;
      if (q < 1) {
        throw new StockStorageError("INSUFFICIENT_ITEM_QUANTITY");
      }
    }

    const cost = rate.cost;
    const cash = Number(walletRow.cash_balance);
    if (cash < cost) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }

    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance - ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ? AND cash_balance >= ?`,
      [cost, nowIso, guildId, userId, cost],
    );
    if (getStatementChanges() !== 1) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }

    const roll = randomInt(0, 100);
    const s = rate.successPercent;
    const d = rate.downgradePercent;
    const x = rate.destroyPercent;

    type RawOutcome = "SUCCESS" | "FAIL_DOWNGRADE" | "DESTROYED" | "FAIL_KEEP";
    let rawOutcome: RawOutcome;
    let rawAfterLevel: number;

    if (roll < s) {
      rawOutcome = "SUCCESS";
      rawAfterLevel = beforeLevel + 1;
    } else if (roll < s + d) {
      rawOutcome = "FAIL_DOWNGRADE";
      rawAfterLevel = Math.max(0, beforeLevel - 1);
    } else if (roll < s + d + x) {
      rawOutcome = "DESTROYED";
      rawAfterLevel = SWORD_DESTROY_RESET_LEVEL;
    } else {
      rawOutcome = "FAIL_KEEP";
      rawAfterLevel = beforeLevel;
    }

    let outcome: SwordEnhanceOutcome;
    let afterLevel: number;
    let usedDowngradeProtection = false;
    let usedDestroyProtection = false;

    if (rawOutcome === "DESTROYED" && useDestroyProtection) {
      consumeCoinConsumableItem(
        guildId,
        userId,
        DESTROY_PROTECTION_TICKET_KEY,
        1,
      );
      usedDestroyProtection = true;
      outcome = "DESTROYED_PROTECTED";
      afterLevel = beforeLevel;
    } else if (rawOutcome === "FAIL_DOWNGRADE" && useDowngradeProtection) {
      consumeCoinConsumableItem(
        guildId,
        userId,
        DOWNGRADE_PROTECTION_TICKET_KEY,
        1,
      );
      usedDowngradeProtection = true;
      outcome = "FAIL_DOWNGRADE_PROTECTED";
      afterLevel = beforeLevel;
    } else {
      outcome = rawOutcome;
      afterLevel = rawAfterLevel;
    }

    const newHighest =
      outcome === "SUCCESS"
        ? Math.max(prevHighest, afterLevel)
        : prevHighest;

    const ta = Number(swordRow.total_attempts) + 1;
    let sc = Number(swordRow.success_count);
    let fc = Number(swordRow.fail_count);
    let dc = Number(swordRow.downgrade_count);
    let dst = Number(swordRow.destroy_count);

    if (outcome === "SUCCESS") {
      sc += 1;
    } else {
      fc += 1;
      if (outcome === "FAIL_DOWNGRADE") {
        dc += 1;
      }
      if (outcome === "DESTROYED") {
        dst += 1;
      }
    }

    db.run(
      `UPDATE coin_swords SET
        level = ?,
        total_attempts = ?,
        success_count = ?,
        fail_count = ?,
        downgrade_count = ?,
        destroy_count = ?,
        highest_level = ?,
        last_enhanced_at = ?,
        updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [
        afterLevel,
        ta,
        sc,
        fc,
        dc,
        dst,
        newHighest,
        nowIso,
        nowIso,
        guildId,
        userId,
      ],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("coin_swords update failed");
    }

    const wAfter = getWalletRow(guildId, userId);
    if (!wAfter) {
      throw new Error("wallet_missing_after_enhance");
    }
    const swordAfterRow = db.get<CoinSwordRow>(
      `SELECT guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at
       FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    if (!swordAfterRow) {
      throw new Error("coin_sword_missing_after_enhance");
    }

    db.run("COMMIT");

    return {
      outcome,
      beforeLevel,
      afterLevel,
      highestLevel: newHighest,
      cost,
      successPercent: s,
      downgradePercent: d,
      destroyPercent: x,
      wallet: mapWallet(wAfter),
      sword: mapCoinSwordRow(swordAfterRow),
      usedDowngradeProtection,
      usedDestroyProtection,
      selectedDowngradeProtection: useDowngradeProtection,
      selectedDestroyProtection: useDestroyProtection,
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

export function calculateDungeonReward(swordLevel: number): number {
  const L = Math.max(
    0,
    Math.min(MAX_SWORD_LEVEL, Math.trunc(Number(swordLevel))),
  );
  let tier = 0;
  if (L >= 5) {
    tier += 500;
  }
  if (L >= 10) {
    tier += 1000;
  }
  if (L >= 15) {
    tier += 2500;
  }
  if (L >= 20) {
    tier += 8000;
  }
  return 1000 + L * 450 + tier;
}

export interface CoinDungeonRun {
  guildId: string;
  userId: string;
  date: string;
  swordLevel: number;
  rewardAmount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface RunCoinDungeonResult {
  alreadyCompleted: boolean;
  run: CoinDungeonRun;
  wallet: StockWallet;
  sword: CoinSword;
}

interface CoinDungeonRunRow {
  guild_id: string;
  user_id: string;
  date: string;
  sword_level: number;
  reward_amount: number;
  balance_after: number;
  created_at: string;
}

function mapCoinDungeonRunRow(row: CoinDungeonRunRow): CoinDungeonRun {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    date: row.date,
    swordLevel: Number(row.sword_level),
    rewardAmount: Number(row.reward_amount),
    balanceAfter: Number(row.balance_after),
    createdAt: row.created_at,
  };
}

export function getCoinDungeonRun(
  guildId: string,
  userId: string,
  date: string,
): CoinDungeonRun | null {
  const row = db.get<CoinDungeonRunRow>(
    `SELECT guild_id, user_id, date, sword_level, reward_amount, balance_after, created_at
     FROM coin_dungeon_runs WHERE guild_id = ? AND user_id = ? AND date = ?`,
    [guildId, userId, date],
  );
  return row ? mapCoinDungeonRunRow(row) : null;
}

function ensureCoinSwordRowInDungeonTx(
  guildId: string,
  userId: string,
  nowIso: string,
): CoinSwordRow {
  let swordRow = db.get<CoinSwordRow>(
    `SELECT guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at
     FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId],
  );
  if (!swordRow) {
    db.run(
      `INSERT OR IGNORE INTO coin_swords (guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
      [guildId, userId, nowIso, nowIso],
    );
    swordRow = db.get<CoinSwordRow>(
      `SELECT guild_id, user_id, level, total_attempts, success_count, fail_count, downgrade_count, destroy_count, highest_level, last_enhanced_at, created_at, updated_at
       FROM coin_swords WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
  }
  if (!swordRow) {
    throw new Error("coin_sword_row_missing");
  }
  return swordRow;
}

export function runCoinDungeon(
  guildId: string,
  userId: string,
  date: string,
): RunCoinDungeonResult {
  const nowIso = new Date().toISOString();
  db.run("BEGIN IMMEDIATE");
  try {
    const existingRun = db.get<CoinDungeonRunRow>(
      `SELECT guild_id, user_id, date, sword_level, reward_amount, balance_after, created_at
       FROM coin_dungeon_runs WHERE guild_id = ? AND user_id = ? AND date = ?`,
      [guildId, userId, date],
    );

    if (existingRun) {
      ensureWalletRow(guildId, userId, nowIso);
      const swordRow = ensureCoinSwordRowInDungeonTx(guildId, userId, nowIso);
      const w = getWalletRow(guildId, userId);
      if (!w) {
        throw new Error("wallet_missing_after_dungeon_check");
      }
      db.run("COMMIT");
      return {
        alreadyCompleted: true,
        run: mapCoinDungeonRunRow(existingRun),
        wallet: mapWallet(w),
        sword: mapCoinSwordRow(swordRow),
      };
    }

    ensureWalletRow(guildId, userId, nowIso);
    const swordRow = ensureCoinSwordRowInDungeonTx(guildId, userId, nowIso);

    const levelRaw = Number(swordRow.level);
    const swordLevel = Math.max(
      0,
      Math.min(MAX_SWORD_LEVEL, Math.trunc(levelRaw)),
    );
    const reward = calculateDungeonReward(swordLevel);

    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance + ?, total_deposit = total_deposit + ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [reward, reward, nowIso, guildId, userId],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("dungeon wallet update failed");
    }

    const wAfter = getWalletRow(guildId, userId);
    if (!wAfter) {
      throw new Error("wallet_missing_after_dungeon_reward");
    }
    const balanceAfter = Number(wAfter.cash_balance);

    db.run(
      `INSERT INTO coin_dungeon_runs (guild_id, user_id, date, sword_level, reward_amount, balance_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guildId, userId, date, swordLevel, reward, balanceAfter, nowIso],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("coin_dungeon_runs insert failed");
    }

    const inserted = db.get<CoinDungeonRunRow>(
      `SELECT guild_id, user_id, date, sword_level, reward_amount, balance_after, created_at
       FROM coin_dungeon_runs WHERE guild_id = ? AND user_id = ? AND date = ?`,
      [guildId, userId, date],
    );
    if (!inserted) {
      throw new Error("coin_dungeon_runs row missing after insert");
    }

    db.run("COMMIT");
    return {
      alreadyCompleted: false,
      run: mapCoinDungeonRunRow(inserted),
      wallet: mapWallet(wAfter),
      sword: mapCoinSwordRow(swordRow),
    };
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
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

// 알바·낚시: cash만, total_deposit 정책
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

export interface CoinConsumableItem {
  guildId: string;
  userId: string;
  itemKey: string;
  itemName: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

interface CoinConsumableItemRow {
  guild_id: string;
  user_id: string;
  item_key: string;
  item_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export function mapCoinConsumableItemRow(
  row: CoinConsumableItemRow,
): CoinConsumableItem {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    itemKey: row.item_key,
    itemName: row.item_name,
    quantity: Number(row.quantity),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getCoinConsumableItem(
  guildId: string,
  userId: string,
  itemKey: string,
): CoinConsumableItem | null {
  const row = db.get<CoinConsumableItemRow>(
    `SELECT guild_id, user_id, item_key, item_name, quantity, created_at, updated_at
     FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
    [guildId, userId, itemKey],
  );
  return row ? mapCoinConsumableItemRow(row) : null;
}

export function listCoinConsumableItems(
  guildId: string,
  userId: string,
): CoinConsumableItem[] {
  const rows = db.all<CoinConsumableItemRow>(
    `SELECT guild_id, user_id, item_key, item_name, quantity, created_at, updated_at
     FROM coin_consumable_items
     WHERE guild_id = ? AND user_id = ? AND quantity > 0
     ORDER BY item_key ASC`,
    [guildId, userId],
  );
  return rows.map(mapCoinConsumableItemRow);
}

export function addCoinConsumableItem(
  guildId: string,
  userId: string,
  itemKey: string,
  itemName: string,
  quantity: number,
): CoinConsumableItem {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("addCoinConsumableItem: quantity must be a positive integer");
  }
  const nowIso = new Date().toISOString();
  const existing = db.get<CoinConsumableItemRow>(
    `SELECT guild_id, user_id, item_key, item_name, quantity, created_at, updated_at
     FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
    [guildId, userId, itemKey],
  );
  if (existing) {
    db.run(
      `UPDATE coin_consumable_items SET quantity = quantity + ?, item_name = ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
      [quantity, itemName, nowIso, guildId, userId, itemKey],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("coin_consumable_items update failed");
    }
  } else {
    db.run(
      `INSERT INTO coin_consumable_items (guild_id, user_id, item_key, item_name, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guildId, userId, itemKey, itemName, quantity, nowIso, nowIso],
    );
    if (getStatementChanges() !== 1) {
      throw new Error("coin_consumable_items insert failed");
    }
  }
  const row = db.get<CoinConsumableItemRow>(
    `SELECT guild_id, user_id, item_key, item_name, quantity, created_at, updated_at
     FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
    [guildId, userId, itemKey],
  );
  if (!row) {
    throw new Error("coin_consumable_items row missing after add");
  }
  return mapCoinConsumableItemRow(row);
}

// 보유 수량 0이면 row 삭제
export function consumeCoinConsumableItem(
  guildId: string,
  userId: string,
  itemKey: string,
  quantity: number,
): CoinConsumableItem | null {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("consumeCoinConsumableItem: quantity must be a positive integer");
  }
  const nowIso = new Date().toISOString();
  db.run(
    `UPDATE coin_consumable_items SET quantity = quantity - ?, updated_at = ?
     WHERE guild_id = ? AND user_id = ? AND item_key = ? AND quantity >= ?`,
    [quantity, nowIso, guildId, userId, itemKey, quantity],
  );
  if (getStatementChanges() !== 1) {
    throw new StockStorageError("INSUFFICIENT_ITEM_QUANTITY");
  }
  const row = db.get<CoinConsumableItemRow>(
    `SELECT guild_id, user_id, item_key, item_name, quantity, created_at, updated_at
     FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
    [guildId, userId, itemKey],
  );
  if (!row) {
    return null;
  }
  const q = Number(row.quantity);
  if (q <= 0) {
    db.run(
      `DELETE FROM coin_consumable_items WHERE guild_id = ? AND user_id = ? AND item_key = ?`,
      [guildId, userId, itemKey],
    );
    return null;
  }
  return mapCoinConsumableItemRow(row);
}

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
    if (catalog.itemType === "TITLE") {
      const owned = db.get<{ n: number }>(
        `SELECT 1 AS n FROM coin_inventory_items WHERE guild_id = ? AND user_id = ? AND item_key = ? LIMIT 1`,
        [guildId, userId, item.itemKey],
      );
      if (owned) {
        throw new StockStorageError("ITEM_ALREADY_OWNED");
      }
    }
    const cash = Number(walletRow.cash_balance);
    if (cash < item.price) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }
    const nowIso = new Date().toISOString();
    db.run(
      `UPDATE stock_wallets SET cash_balance = cash_balance - ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ? AND cash_balance >= ?`,
      [item.price, nowIso, guildId, userId, item.price],
    );
    if (getStatementChanges() !== 1) {
      throw new StockStorageError("INSUFFICIENT_CASH");
    }
    const w = getWalletRow(guildId, userId)!;
    const balanceAfter = Number(w.cash_balance);

    if (catalog.itemType === "TITLE") {
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
      if (getStatementChanges() !== 1) {
        throw new Error("coin_inventory_items insert failed");
      }
      db.run("COMMIT");
      return { item: catalog, wallet: mapWallet(w), balanceAfter };
    }

    if (catalog.itemType === "CONSUMABLE") {
      addCoinConsumableItem(
        guildId,
        userId,
        catalog.itemKey,
        catalog.name,
        1,
      );
      const after = getCoinConsumableItem(guildId, userId, catalog.itemKey);
      const qty = after?.quantity ?? 1;
      db.run("COMMIT");
      return {
        item: catalog,
        wallet: mapWallet(w),
        balanceAfter,
        consumableQuantityAfter: qty,
      };
    }

    throw new StockStorageError("INVALID_ITEM_TYPE");
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
