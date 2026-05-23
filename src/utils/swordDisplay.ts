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

export function formatSwordNameBoldWithPlus(level: number): string {
  const L = clampLevel(level);
  const t = getSwordTier(L);
  return `**${t.emoji} ${t.name} +${L}**`;
}

export function formatSwordNameBoldNoPlus(level: number): string {
  const L = clampLevel(level);
  const t = getSwordTier(L);
  return `**${t.emoji} ${t.name}**`;
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

export const MY_SWORD_LEVEL_FLAVOR: readonly string[] = [
  "아직 이름 없는 쇳덩이지만, 손에 익을수록 무게가 살아납니다.",
  "아직 검에 첫 빛이 감돌기 시작했습니다.",
  "잔금이 조금씩 말끔해지며 날이 서기 시작합니다.",
  "스승의 말처럼 하루 한 번씩만 닦아도 달라집니다.",
  "짧은 연습이 쌓여 검끝에 작은 소리가 납니다.",
  "이제 막 장비라 부를 만한 형태를 갖춥니다.",
  "공기를 가르며 푸른 기운이 아주 얇게 맴돕니다.",
  "한뼘 앞의 목표가 조금 더 또렷해집니다.",
  "손목에 힘이 덜 들어가도 같은 궤적이 나옵니다.",
  "밤마다 닦는 날이 줄어도 광이 유지됩니다.",
  "주변에서 ‘그 검 좀 나왔다’는 말이 들립니다.",
  "열기가 감돌아 닿는 것만으로도 따뜻합니다.",
  "실패의 흔적마저 날을 세우는 밑거름이 됩니다.",
  "강화석 부스러기가 날아와도 겉면은 흐트러지지 않습니다.",
  "이제 ‘장난감’이라 부르는 사람은 없습니다.",
  "길드 안에서도 손에 꼽는 날카로움입니다.",
  "한 번 휘두르면 주변의 시선이 잠시 멈춥니다.",
  "위험한 구간이지만, 그만큼 보답도 크게 느껴집니다.",
  "별빛이 날에 스며들 듯 은은하게 번집니다.",
  "한 걸음만 더 가면 전설의 문턱입니다.",
  "전설의 검. 이 서버에서 정점에 선 무게입니다.",
];

export const ENHANCE_SUCCESS_FLAVOR: readonly string[] = [
  "",
  "낡은 줄이 벗겨지고, 처음으로 ‘검’다운 차가움이 돋습니다.",
  "검이 더 날카롭게 빛납니다.",
  "날 끝에서 잔잔한 울림이 한 박자 길어졌습니다.",
  "손바닥에 전해지는 진동이 조금 더 또렷해졌습니다.",
  "짧은 호흡으로도 같은 궤적을 그리기 쉬워졌습니다.",
  "푸른 기운이 검신을 아주 얇게 감싸 돕습니다.",
  "한 수 앞을 읽는 듯한 밸런스가 손에 붙습니다.",
  "공기를 가를 때마다 잔광이 조금 더 오래 남습니다.",
  "실패했던 날의 금도, 이제는 날을 세우는 무늬처럼 보입니다.",
  "주변의 소음이 잠시 가라앉는 찰나의 고요가 따라옵니다.",
  "열기가 날을 감싸며, 다음 도약을 재촉합니다.",
  "위험한 구간이지만, 그만큼 보상의 무게도 느껴집니다.",
  "검끝이 스스로 방향을 짚어 주는 듯한 감각이 옵니다.",
  "한 번의 성공이 예전만큼 당연해지지 않을 만큼 무겁습니다.",
  "희귀한 빛줄기가 검신 위를 짧게 타고 지나갑니다.",
  "영웅이라 불릴 만한 무게가 손목에 실립니다.",
  "실패의 그림자가 아니라, 다음 성공을 위한 지도가 됩니다.",
  "별빛이 스며들어 낮과 밤의 경계가 흐릿해집니다.",
  "전설의 문턱에서 숨이 닿는 거리까지 왔습니다.",
  "전설의 검. 이 순간만큼은 서버의 정점에 선 느낌입니다.",
];

export function getMySwordLevelFlavor(level: number): string {
  const L = clampLevel(level);
  return MY_SWORD_LEVEL_FLAVOR[L] ?? MY_SWORD_LEVEL_FLAVOR[0]!;
}

export function getEnhanceSuccessFlavor(newLevel: number): string {
  const L = clampLevel(newLevel);
  return ENHANCE_SUCCESS_FLAVOR[L] ?? ENHANCE_SUCCESS_FLAVOR[1]!;
}

export function formatMySwordPanelDescription(level: number): string {
  const t = getSwordTier(level);
  const L = clampLevel(level);
  const head = `**${t.emoji} ${t.name} +${L}** \`${t.tier}\``;
  const sub = `${t.tier} · ${getMySwordLevelFlavor(L)}`;
  return `${head}\n\n${sub}`;
}

export function formatEnhanceArrowCode(before: number, after: number): string {
  const b = clampLevel(before);
  const a = clampLevel(after);
  return `\`+${b}  ━━━▶  +${a}\``;
}

export function formatEnhanceKeepCode(level: number): string {
  const L = clampLevel(level);
  return `\`+${L} 유지\``;
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
