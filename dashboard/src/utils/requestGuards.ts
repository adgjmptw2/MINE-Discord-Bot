/** 서버 전환 후 stale 응답 무시 */
export function isStaleGuild(
  requestGuildId: string,
  currentGuildId: string | null,
): boolean {
  return currentGuildId !== requestGuildId;
}
