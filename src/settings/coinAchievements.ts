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
  {
    key: "attendance_7",
    name: "일주일 출석",
    description: "출석을 7회 이상 합니다.",
    rewardAmount: 3_000,
    category: "BASIC",
  },
  {
    key: "attendance_30",
    name: "한 달 출석",
    description: "출석을 30회 이상 합니다.",
    rewardAmount: 10_000,
    category: "BASIC",
  },
  {
    key: "work_10",
    name: "알바 숙련자",
    description: "알바를 10회 이상 합니다.",
    rewardAmount: 5_000,
    category: "BASIC",
  },
  {
    key: "fishing_10",
    name: "낚시 숙련자",
    description: "낚시를 10회 이상 합니다.",
    rewardAmount: 5_000,
    category: "BASIC",
  },
  {
    key: "rps_20",
    name: "승부를 즐기는 자",
    description: "가위바위보를 20회 이상 합니다.",
    rewardAmount: 5_000,
    category: "GAME",
  },
  {
    key: "rps_win_10",
    name: "승리 수집가",
    description: "가위바위보에서 10회 이상 승리합니다.",
    rewardAmount: 8_000,
    category: "GAME",
  },
  {
    key: "shop_title_1",
    name: "칭호 수집 시작",
    description: "칭호를 1개 이상 보유합니다.",
    rewardAmount: 3_000,
    category: "SHOP",
  },
  {
    key: "shop_title_3",
    name: "칭호 수집가",
    description: "칭호를 3개 이상 보유합니다.",
    rewardAmount: 8_000,
    category: "SHOP",
  },
  {
    key: "stock_trade_10",
    name: "매매 입문자",
    description: "주식 거래를 10회 이상 합니다.",
    rewardAmount: 8_000,
    category: "STOCK",
  },
  {
    key: "stock_diversified_3",
    name: "분산 투자자",
    description: "서로 다른 종목을 3개 이상 보유합니다.",
    rewardAmount: 10_000,
    category: "STOCK",
  },
  {
    key: "sword_first_enhance",
    name: "첫 강화",
    description: "검 강화를 1회 이상 시도합니다.",
    rewardAmount: 2_000,
    category: "GAME",
  },
  {
    key: "sword_level_5",
    name: "단련의 시작",
    description: "검을 5강 이상 달성합니다.",
    rewardAmount: 5_000,
    category: "GAME",
  },
  {
    key: "sword_level_10",
    name: "빛나는 검",
    description: "검을 10강 이상 달성합니다.",
    rewardAmount: 15_000,
    category: "GAME",
  },
  {
    key: "sword_level_12",
    name: "고난의 입구",
    description: "검을 12강 이상 달성합니다.",
    rewardAmount: 25_000,
    category: "GAME",
  },
  {
    key: "sword_level_15",
    name: "영웅의 검",
    description: "검을 15강 이상 달성합니다.",
    rewardAmount: 50_000,
    category: "GAME",
  },
  {
    key: "sword_level_18",
    name: "전설 직전",
    description: "검을 18강 이상 달성합니다.",
    rewardAmount: 120_000,
    category: "GAME",
  },
  {
    key: "sword_level_20",
    name: "전설의 검",
    description: "검을 20강 달성합니다.",
    rewardAmount: 300_000,
    category: "GAME",
  },
  {
    key: "sword_attempt_100",
    name: "강화 장인",
    description: "검 강화를 100회 이상 시도합니다.",
    rewardAmount: 50_000,
    category: "GAME",
  },
  {
    key: "dungeon_run_7",
    name: "던전 탐험가",
    description: "던전을 7회 이상 완료합니다.",
    rewardAmount: 15_000,
    category: "GAME",
  },
  {
    key: "dungeon_run_30",
    name: "던전 개근",
    description: "던전을 30회 이상 완료합니다.",
    rewardAmount: 80_000,
    category: "GAME",
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
