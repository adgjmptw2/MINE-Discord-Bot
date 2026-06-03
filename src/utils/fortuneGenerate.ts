import { createHash } from "node:crypto";
import { truncate } from "@/utils/discord";
import { getZodiacSignFromBirthDate, type FortuneGender } from "@/utils/fortuneInput";

const OVERALL_FORTUNES = [
  "오늘은 작은 정리와 점검이 행운으로 이어질 수 있어요.",
  "천천히 진행해도 괜찮은 하루예요. 급하게 결정하지 않아도 돼요.",
  "가벼운 산책이나 스트레칭이 기분 전환에 도움이 될 수 있어요.",
  "오늘은 ‘한 가지씩’ 처리하는 방식이 잘 맞을 수 있어요.",
  "주변 소음을 조금 줄이면 집중이 잘 될 수 있어요.",
  "작은 목표를 하나 정해 두면 하루가 편해질 수 있어요.",
  "새로운 시도보다 익숙한 루틴을 다듬는 날이에요.",
  "잠깐의 휴식이 생각보다 큰 도움이 될 수 있어요.",
  "오늘은 기록을 남겨 두면 나중에 도움이 될 수 있어요.",
  "가벼운 대화 한마디가 기분을 밝게 만들 수 있어요.",
] as const;

const RELATIONSHIP_FORTUNES = [
  "무리하게 맞추기보다 짧고 솔직한 대화가 좋아요.",
  "경청이 오늘의 포인트예요. 말보다 듣는 비중을 늘려 보세요.",
  "부담 없는 주제로 이야기를 나누면 편해요.",
  "오늘은 ‘미안해’ ‘고마워’ 한마디가 특히 잘 맞아요.",
  "연락 주기를 조금 늦춰도 관계는 무너지지 않아요.",
  "짧게 인사만 해도 분위기가 부드러워질 수 있어요.",
  "상대의 속도를 존중하면 마음이 가벼워져요.",
  "오늘은 농담 한 번보다 공감 한마디가 잘 맞아요.",
  "혼자만의 시간도 관계를 위한 충전이 될 수 있어요.",
  "기대치를 조금 낮추면 만족이 커질 수 있어요.",
] as const;

const COIN_FORTUNES = [
  "오늘은 코인을 쓰기보다 모으는 쪽이 잘 맞을 수 있어요.",
  "작은 보상을 챙기기 좋은 날이에요.",
  "충동적인 코인 사용보다 목표를 정하는 쪽이 좋아요.",
  "오늘은 ‘오늘만 쓸 예산’을 정해 두면 마음이 편해요.",
  "가벼운 참여부터 시작하면 부담이 줄어들 수 있어요.",
  "기록을 남겨 두면 나중에 패턴을 보기 좋아요.",
  "오늘은 큰 지출보다 작은 절약이 잘 맞아요.",
  "친구와 목표를 공유하면 지키기 쉬워질 수 있어요.",
  "보상을 받았다면 잠깐 쉬었다가 다음을 계획해 보세요.",
  "오늘은 ‘필요한 것’과 ‘하고 싶은 것’을 나눠 적어 보세요.",
] as const;

const GAME_FORTUNES = [
  "가볍게 즐기면 흐름이 좋아질 수 있어요.",
  "연패하면 잠깐 쉬어가는 게 좋아요.",
  "한 판 끝나고 물 한 잔 마시는 타이밍을 추천해요.",
  "오늘은 연습 모드처럼 부담 없이 즐기면 좋아요.",
  "짧게 끊고 다시 시작하면 집중이 돌아올 수 있어요.",
  "친구와 번갈아 하면 피로가 덜해요.",
  "오늘은 결과보다 과정을 즐기면 편해요.",
  "규칙을 한 번만 다시 읽어 보면 실수가 줄어들 수 있어요.",
  "승패에 연연하지 않으면 오히려 재미가 커져요.",
  "새로운 모드보다 익숙한 모드가 잘 맞을 수 있어요.",
] as const;

const LUCKY_KEYWORDS = [
  "차분함",
  "균형",
  "여유",
  "정리",
  "호기심",
  "친절",
  "집중",
  "유연함",
  "소통",
  "리듬",
] as const;

const LUCKY_COLORS = [
  "파랑",
  "연두",
  "베이지",
  "하늘색",
  "연보라",
  "민트",
  "살구",
  "회색",
  "아이보리",
  "연분홍",
] as const;

function hashPickIndex(
  seed: string,
  salt: string,
  modulo: number,
): number {
  const h = createHash("sha256").update(`${seed}:${salt}`).digest();
  const nSigned =
    h.readUInt32BE(0) ^
    h.readUInt32BE(4) ^
    h.readUInt32BE(8) ^
    h.readUInt32BE(12);
  const n = nSigned >>> 0;
  return modulo <= 0 ? 0 : n % modulo;
}

function pickByHash<T extends string>(
  items: readonly T[],
  seed: string,
  salt: string,
): T {
  const i = hashPickIndex(seed, salt, items.length);
  return items[i]!;
}

export function buildFortuneSeed(
  userId: string,
  birthDate: string,
  gender: FortuneGender,
  todayKst: string,
): string {
  return `${userId}:${birthDate}:${gender}:${todayKst}`;
}

export interface FortuneComputed {
  seed: string;
  todayKst: string;
  overall: string;
  relation: string;
  coin: string;
  game: string;
  keyword: string;
  color: string;
  luckyNum: number;
}

export function computeFortune(
  userId: string,
  birthDate: string,
  gender: FortuneGender,
  todayKst: string,
): FortuneComputed {
  const seed = buildFortuneSeed(userId, birthDate, gender, todayKst);
  return {
    seed,
    todayKst,
    overall: pickByHash(OVERALL_FORTUNES, seed, "overall"),
    relation: pickByHash(RELATIONSHIP_FORTUNES, seed, "relation"),
    coin: pickByHash(COIN_FORTUNES, seed, "coin"),
    game: pickByHash(GAME_FORTUNES, seed, "game"),
    keyword: pickByHash(LUCKY_KEYWORDS, seed, "keyword"),
    color: pickByHash(LUCKY_COLORS, seed, "color"),
    luckyNum: 1 + hashPickIndex(seed, "number", 99),
  };
}

export function fortuneResultPanelFields(
  f: FortuneComputed,
  normalizedBirthDate: string,
): { description: string; lines: string[] } {
  const zodiac = getZodiacSignFromBirthDate(normalizedBirthDate);
  const luckyLine = `${f.color} · ${f.luckyNum} · ${truncate(f.keyword, 24)}`;
  const description = `**${zodiac} · ${f.todayKst}**`;
  const lines = [
    "☀️ **오늘의 흐름**",
    f.overall,
    "",
    "💬 **대인운**",
    f.relation,
    "",
    "💰 **코인운**",
    f.coin,
    "",
    "🎮 **게임운**",
    f.game,
    "",
    "🍀 **행운 포인트**",
    luckyLine,
  ];
  return { description, lines };
}

function fortuneGradeLabel(luckyNum: number): string {
  if (luckyNum >= 77) {
    return "대길";
  }
  if (luckyNum >= 55) {
    return "길";
  }
  if (luckyNum >= 33) {
    return "소길";
  }
  return "흉";
}

export function compactFortunePanelFields(
  f: FortuneComputed,
  normalizedBirthDate: string,
): { title: string; description: string; lines: string[] } {
  const zodiac = getZodiacSignFromBirthDate(normalizedBirthDate);
  const grade = fortuneGradeLabel(f.luckyNum);
  const gradeSuffix = grade === "대길" ? " ✦" : "";
  const luckyLine = `${f.keyword} · ${f.color} · ${f.luckyNum}`;
  return {
    title: `오늘의 운세 — ${grade}${gradeSuffix}`,
    description: `${zodiac} · ${f.todayKst}`,
    lines: [
      "☀️ 오늘의 흐름",
      f.overall,
      "",
      "💬 대인운",
      f.relation,
      "",
      "💰 코인운",
      f.coin,
      "",
      "🎮 게임운",
      f.game,
      "",
      "🍀 행운 포인트",
      luckyLine,
    ],
  };
}
