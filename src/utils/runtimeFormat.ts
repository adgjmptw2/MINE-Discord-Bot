import { truncate } from "@/utils/discord";

/** 프로세스 업타임을 짧은 한국어 문자열로 */
export function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) {
    return `${days}일 ${hours}시간 ${mins}분`;
  }
  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
}

/** RSS 등 바이트 → 읽기 쉬운 MB */
export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : mb.toFixed(0)} MB`;
}

export function truncateText(text: string, max: number): string {
  return truncate(text, max);
}
