export type CoinAchievementCategory = "BASIC" | "GAME" | "STOCK" | "SHOP";

export interface CoinAchievement {
  key: string;
  name: string;
  description: string;
  rewardAmount: number;
  category: CoinAchievementCategory;
}

const COIN_ACHIEVEMENTS: readonly CoinAchievement[] = [
  {
    key: "first_attendance",
    name: "첫 출석",
    description: "출석을 1회 이상 합니다.",
    rewardAmount: 1_000,
    category: "BASIC",
  },
  {
    key: "first_work",
    name: "알바 입문",
    description: "알바를 1회 이상 합니다.",
    rewardAmount: 1_000,
    category: "BASIC",
  },
  {
    key: "first_fishing",
    name: "낚시 입문",
    description: "낚시를 1회 이상 합니다.",
    rewardAmount: 1_000,
    category: "BASIC",
  },
  {
    key: "first_rps",
    name: "첫 승부",
    description: "가위바위보를 1회 이상 합니다.",
    rewardAmount: 1_000,
    category: "GAME",
  },
  {
    key: "first_rps_win",
    name: "승리의 맛",
    description: "가위바위보에서 승리합니다.",
    rewardAmount: 2_000,
    category: "GAME",
  },
  {
    key: "first_stock_trade",
    name: "첫 투자",
    description: "주식 거래를 1회 이상 합니다.",
    rewardAmount: 2_000,
    category: "STOCK",
  },
  {
    key: "first_stock_buy",
    name: "첫 매수",
    description: "주식 매수를 1회 이상 합니다.",
    rewardAmount: 1_500,
    category: "STOCK",
  },
  {
    key: "first_stock_sell",
    name: "첫 매도",
    description: "주식 매도를 1회 이상 합니다.",
    rewardAmount: 1_500,
    category: "STOCK",
  },
  {
    key: "first_shop_purchase",
    name: "첫 구매",
    description: "상점에서 아이템을 구매합니다.",
    rewardAmount: 2_000,
    category: "SHOP",
  },
  {
    key: "first_title_equipped",
    name: "칭호 장착",
    description: "칭호를 장착합니다.",
    rewardAmount: 1_000,
    category: "SHOP",
  },
] as const;

export function getCoinAchievements(): readonly CoinAchievement[] {
  return COIN_ACHIEVEMENTS;
}

export function findCoinAchievement(input: string): CoinAchievement | undefined {
  const t = input.trim();
  if (!t) {
    return undefined;
  }
  const lower = t.toLowerCase();
  const byKey = COIN_ACHIEVEMENTS.find((a) => a.key.toLowerCase() === lower);
  if (byKey) {
    return byKey;
  }
  return COIN_ACHIEVEMENTS.find(
    (a) => a.name === t || a.name.includes(t),
  );
}
