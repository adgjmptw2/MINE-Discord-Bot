export type CoinShopItemType = "TITLE" | "CONSUMABLE";

export interface CoinShopItem {
  itemKey: string;
  itemType: CoinShopItemType;
  name: string;
  description: string;
  price: number;
}

const COIN_SHOP_ITEMS: readonly CoinShopItem[] = [
  {
    itemKey: "beginner_investor",
    itemType: "TITLE",
    name: "초보 투자자",
    description: "처음 투자를 시작한 유저를 위한 칭호",
    price: 5_000,
  },
  {
    itemKey: "lucky_fisher",
    itemType: "TITLE",
    name: "행운의 낚시꾼",
    description: "낚시를 즐기는 유저를 위한 칭호",
    price: 15_000,
  },
  {
    itemKey: "coin_collector",
    itemType: "TITLE",
    name: "코인 수집가",
    description: "코인을 모으는 재미를 아는 유저를 위한 칭호",
    price: 30_000,
  },
  {
    itemKey: "big_hand",
    itemType: "TITLE",
    name: "서버의 큰손",
    description: "서버 경제에서 존재감이 큰 유저를 위한 칭호",
    price: 100_000,
  },
  {
    itemKey: "steady_attendee",
    itemType: "TITLE",
    name: "성실한 출석러",
    description: "꾸준히 출석하는 유저를 위한 칭호",
    price: 20_000,
  },
  {
    itemKey: "part_time_master",
    itemType: "TITLE",
    name: "알바 장인",
    description: "성실하게 코인을 모으는 유저를 위한 칭호",
    price: 25_000,
  },
  {
    itemKey: "fishing_master",
    itemType: "TITLE",
    name: "낚시 명인",
    description: "낚시의 손맛을 아는 유저를 위한 칭호",
    price: 35_000,
  },
  {
    itemKey: "challenger",
    itemType: "TITLE",
    name: "승부사",
    description: "가위바위보 승부를 즐기는 유저를 위한 칭호",
    price: 40_000,
  },
  {
    itemKey: "lucky_hand",
    itemType: "TITLE",
    name: "행운의 손",
    description: "운을 믿고 도전하는 유저를 위한 칭호",
    price: 50_000,
  },
  {
    itemKey: "market_rookie",
    itemType: "TITLE",
    name: "모의투자 신입",
    description: "모의투자를 시작한 유저를 위한 칭호",
    price: 60_000,
  },
  {
    itemKey: "chart_watcher",
    itemType: "TITLE",
    name: "차트 관찰자",
    description: "시세를 자주 확인하는 유저를 위한 칭호",
    price: 80_000,
  },
  {
    itemKey: "coin_strategist",
    itemType: "TITLE",
    name: "코인 전략가",
    description: "코인을 계획적으로 사용하는 유저를 위한 칭호",
    price: 120_000,
  },
  {
    itemKey: "server_noble",
    itemType: "TITLE",
    name: "서버의 귀족",
    description: "서버 경제에서 품격을 보여주는 유저를 위한 칭호",
    price: 250_000,
  },
  {
    itemKey: "legend_big_hand",
    itemType: "TITLE",
    name: "전설의 큰손",
    description: "서버 경제의 전설을 꿈꾸는 유저를 위한 칭호",
    price: 500_000,
  },
  {
    itemKey: "sword_apprentice",
    itemType: "TITLE",
    name: "강화 수련생",
    description: "검 강화를 시작한 유저를 위한 칭호",
    price: 40_000,
  },
  {
    itemKey: "sword_blacksmith",
    itemType: "TITLE",
    name: "검의 장인",
    description: "강화의 손맛을 아는 유저를 위한 칭호",
    price: 100_000,
  },
  {
    itemKey: "dungeon_explorer",
    itemType: "TITLE",
    name: "던전 탐험가",
    description: "던전을 꾸준히 도는 유저를 위한 칭호",
    price: 150_000,
  },
  {
    itemKey: "sword_master",
    itemType: "TITLE",
    name: "검술의 달인",
    description: "강한 검을 꿈꾸는 유저를 위한 칭호",
    price: 300_000,
  },
  {
    itemKey: "legendary_sword_owner",
    itemType: "TITLE",
    name: "전설검의 주인",
    description: "전설의 검을 향해 나아가는 유저를 위한 칭호",
    price: 700_000,
  },
  {
    itemKey: "downgrade_protection_ticket",
    itemType: "CONSUMABLE",
    name: "하락 방지권",
    description: "검 강화 실패로 단계가 하락할 때 1회 막아주는 소비 아이템",
    price: 50_000,
  },
  {
    itemKey: "destroy_protection_ticket",
    itemType: "CONSUMABLE",
    name: "파괴 방지권",
    description: "검 강화 실패로 검이 파괴될 때 1회 막아주는 소비 아이템",
    price: 150_000,
  },
] as const;

export function getCoinShopItems(): readonly CoinShopItem[] {
  return COIN_SHOP_ITEMS;
}

/** `item_key` 정확 일치, 전체 이름 일치, 이름 부분 일치, 1-based 번호 */
export function findCoinShopItem(input: string): CoinShopItem | undefined {
  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  const items = [...COIN_SHOP_ITEMS];

  const asIndex = Number(raw);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= items.length) {
    return items[asIndex - 1];
  }

  const keyLower = raw.toLowerCase();
  const byKey = items.find((i) => i.itemKey.toLowerCase() === keyLower);
  if (byKey) {
    return byKey;
  }

  const byFullName = items.find((i) => i.name === raw);
  if (byFullName) {
    return byFullName;
  }

  return items.find((i) => i.name.includes(raw));
}
