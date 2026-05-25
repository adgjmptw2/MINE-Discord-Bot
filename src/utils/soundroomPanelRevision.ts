/** 길드별 Soundroom 패널 edit 세대. 오래된 비동기 edit가 최신 패널을 덮지 않게 합니다. */
const revisions = new Map<string, number>();

export function getSoundroomPanelRevision(guildId: string): number {
  return revisions.get(guildId) ?? 0;
}

export function bumpSoundroomPanelRevision(guildId: string): number {
  const next = getSoundroomPanelRevision(guildId) + 1;
  revisions.set(guildId, next);
  return next;
}

export function isSoundroomPanelRevisionCurrent(
  guildId: string,
  revision: number,
): boolean {
  return getSoundroomPanelRevision(guildId) === revision;
}
