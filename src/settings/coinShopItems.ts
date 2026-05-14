export type CoinShopItemType = "TITLE";

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
