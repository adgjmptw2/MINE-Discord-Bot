import { getKstDateString } from "@/utils/date";

export type ParsedBirth =
  | { ok: true; normalized: string; year: number; month: number; day: number }
  | { ok: false };

export type FortuneGender = "male" | "female" | "other" | "private";

export interface FortuneProfilePlain {
  birthDate: string;
  gender: FortuneGender;
}

export function parseBirthDateInput(raw: string): ParsedBirth {
  const input = raw.trim();
  if (!input) {
    return { ok: false };
  }

  let yStr: string;
  let mStr: string;
  let dStr: string;

  const m8 = /^(\d{4})(\d{2})(\d{2})$/.exec(input);
  if (m8) {
    yStr = m8[1]!;
    mStr = m8[2]!;
    dStr = m8[3]!;
  } else {
    const m10 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!m10) {
      return { ok: false };
    }
    yStr = m10[1]!;
    mStr = m10[2]!;
    dStr = m10[3]!;
  }

  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return { ok: false };
  }

  const today = getKstDateString();
  const todayY = Number(today.slice(0, 4));
  if (year < 1900 || year > todayY) {
    return { ok: false };
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false };
  }

  const t = new Date(Date.UTC(year, month - 1, day));
  if (
    t.getUTCFullYear() !== year ||
    t.getUTCMonth() !== month - 1 ||
    t.getUTCDate() !== day
  ) {
    return { ok: false };
  }

  const normalized = `${yStr}-${mStr}-${dStr}`;
  if (normalized > today) {
    return { ok: false };
  }

  return { ok: true, normalized, year, month, day };
}

export function parseGenderInput(raw: string): {
  gender: FortuneGender;
  unknownAsPrivate: boolean;
} {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return { gender: "private", unknownAsPrivate: false };
  }
  if (["남성", "남자", "male", "m"].includes(t)) {
    return { gender: "male", unknownAsPrivate: false };
  }
  if (["여성", "여자", "female", "f"].includes(t)) {
    return { gender: "female", unknownAsPrivate: false };
  }
  if (["기타", "other"].includes(t)) {
    return { gender: "other", unknownAsPrivate: false };
  }
  if (["비공개", "없음", "private", "skip", "-", "미입력"].includes(t)) {
    return { gender: "private", unknownAsPrivate: false };
  }
  return { gender: "private", unknownAsPrivate: true };
}
