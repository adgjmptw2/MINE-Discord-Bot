/** Asia/Seoul 기준 달력 날짜 `YYYY-MM-DD` (출석 일자 저장용) */
export function getKstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
