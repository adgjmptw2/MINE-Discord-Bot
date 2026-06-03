export function isStaleGuild(
  requestGuildId: string,
  currentGuildId: string | null,
): boolean {
  return currentGuildId !== requestGuildId;
}
