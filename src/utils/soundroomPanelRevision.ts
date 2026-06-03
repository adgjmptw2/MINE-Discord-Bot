// 패널 edit 세대 — stale 비동기 edit 방지
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
