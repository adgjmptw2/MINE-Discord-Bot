const MAX_LEVEL = 20;

export interface SwordTier {
  emoji: string;
  name: string;
  tier: string;
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_LEVEL, Math.trunc(level)));
}

export function getSwordTier(level: number): SwordTier {
  const L = clampLevel(level);
  if (L === 0) {
    return { emoji: "🗡️", name: "낡은 검", tier: "시작" };
  }
  if (L <= 5) {
    return { emoji: "⚔️", name: "단련된 검", tier: "초급" };
  }
  if (L <= 10) {
    return { emoji: "🔹", name: "빛나는 검", tier: "중급" };
  }
  if (L <= 14) {
    return { emoji: "🔥", name: "뜨거운 검", tier: "고급" };
  }
  if (L <= 17) {
    return { emoji: "💠", name: "영웅의 검", tier: "희귀" };
  }
  if (L <= 19) {
    return { emoji: "🌌", name: "별빛의 검", tier: "전설 직전" };
  }
  return { emoji: "👑", name: "전설의 검", tier: "최고" };
}

export function formatSwordName(level: number): string {
  const L = clampLevel(level);
  const t = getSwordTier(L);
  return `${t.emoji} ${t.name} +${L}`;
}

export function formatSwordLevel(level: number): string {
  return `+${clampLevel(level)}`;
}

export function formatSwordProgress(level: number): string {
  const L = clampLevel(level);
  const filled = Math.min(10, Math.round((L / MAX_LEVEL) * 10));
  const bar = `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
  return `${bar} ${L}/${MAX_LEVEL}`;
}

export function formatSwordDangerHint(level: number): string {
  const L = clampLevel(level);
  if (L >= 20) {
    return "최대 강화. 던전 보상만 받을 수 있습니다.";
  }
  if (L >= 18) {
    return "최고 난이도. 20강은 장기 목표입니다.";
  }
  if (L >= 15) {
    return "고강화 구간. 방지권을 고려하세요.";
  }
  if (L >= 12) {
    return "12강부터 난이도가 크게 오릅니다.";
  }
  if (L === 11) {
    return "파괴 위험이 생깁니다.";
  }
  if (L >= 6) {
    return "하락 위험이 생기기 시작합니다.";
  }
  return "비교적 안전한 구간입니다.";
}

export function formatSwordShortSummary(
  level: number,
  highestLevel: number,
): string {
  const h = Math.max(0, Math.min(MAX_LEVEL, Math.trunc(Number(highestLevel))));
  return `${formatSwordName(level)} · 최고 +${h}`;
}

export function formatDungeonMoodLine(level: number): string {
  const L = clampLevel(level);
  if (L >= 20) {
    return "전설의 검으로 던전을 마쳤습니다.";
  }
  if (L >= 15) {
    return "강한 검으로 보상이 풍성했습니다.";
  }
  if (L >= 10) {
    return "검이 눈에 띄게 강해졌습니다.";
  }
  if (L >= 5) {
    return "검이 조금씩 성장했습니다.";
  }
  return "던전을 무사히 마쳤습니다.";
}

export const SWORD_VIRTUAL_GAME_FOOTER = [
  "※ 검 강화와 던전은 서버 내 가상 코인 게임 기능입니다.",
  "※ 실제 돈, 환전, 현물 보상과 관련이 없습니다.",
] as const;
