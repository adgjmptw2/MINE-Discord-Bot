/** Asia/Seoul 기준 달력 날짜 `YYYY-MM-DD` (출석 일자 저장용) */
export function getKstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * KST 달력 날짜 `YYYY-MM-DD` 하루의 UTC 구간 `[startIso, endExclusiveIso)`.
 * 서울은 UTC+9 고정(일광절약시 없음).
 */
export function getKstDayUtcIsoBounds(kstYmd: string): {
  startIso: string;
  endExclusiveIso: string;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kstYmd.trim());
  if (!m) {
    throw new Error(`Invalid KST date string: ${kstYmd}`);
  }
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mon) || !Number.isInteger(d)) {
    throw new Error(`Invalid KST date string: ${kstYmd}`);
  }
  const startMs = Date.UTC(y, mon - 1, d, -9, 0, 0, 0);
  const endMs = Date.UTC(y, mon - 1, d + 1, -9, 0, 0, 0);
  return {
    startIso: new Date(startMs).toISOString(),
    endExclusiveIso: new Date(endMs).toISOString(),
  };
}

/** KST 달력 `YYYY-MM-DD`에 `deltaDays`만큼 더한 날짜(동일 `YYYY-MM-DD` 표기). */
export function addKstCalendarDays(ymd: string, deltaDays: number): string {
  const { startIso } = getKstDayUtcIsoBounds(ymd);
  const t = new Date(startIso).getTime() + deltaDays * 86_400_000;
  return getKstDateString(new Date(t));
}

/** KST 기준 `now`가 속한 달의 첫날·마지막 날 `YYYY-MM-DD`. */
export function getKstMonthCalendarBounds(now = new Date()): {
  year: string;
  month: string;
  firstYmd: string;
  lastYmd: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const firstYmd = `${year}-${month}-01`;
  const yNum = Number(year);
  const mNum = Number(month);
  const nextFirst =
    mNum === 12
      ? `${yNum + 1}-01-01`
      : `${yNum}-${String(mNum + 1).padStart(2, "0")}-01`;
  const lastYmd = addKstCalendarDays(nextFirst, -1);
  return { year, month, firstYmd, lastYmd };
}

/** KST 기준 자정부터의 경과 분 (0–1439) */
export function getKstMinutesOfDay(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** KST 기준 평일(월–금)이면 true, 토·일은 false. 공휴일은 구분하지 않는다. */
export function isKstWeekday(date = new Date()): boolean {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(date);
  return wd !== "Sat" && wd !== "Sun";
}

/**
 * "HH:mm" → 하루 기준 분 (예: 15:31 → 931, 16:00 → 960).
 * 형식이 아니면 NaN.
 */
export function parseKstTimeToMinutes(value: string): number {
  const v = value.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) {
    return NaN;
  }
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return NaN;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return NaN;
  }
  return hour * 60 + minute;
}

/** 다음 KST 분 경계까지 남은 ms (분 단위 tick 정렬용) */
export function msUntilNextKstMinuteEdge(now = new Date()): number {
  const sec = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      second: "numeric",
    }).format(now),
  );
  const ms = now.getMilliseconds();
  return (60 - sec) * 1000 - ms;
}

/** 분 단위 값을 `HH:mm` 문자열로 (로그용, KST 의미와 무관히 표기만) */
export function formatKstMinutesAsClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * KST 기준 [startMinutes, endMinutes) 구간이면 true.
 * 예: 09:00~15:30 → 540 이상 930 미만만 거래 가능(15:30 정각은 불가).
 */
export function isWithinKstTimeRange(
  date: Date,
  startMinutes: number,
  endMinutes: number,
): boolean {
  const m = getKstMinutesOfDay(date);
  return m >= startMinutes && m < endMinutes;
}
