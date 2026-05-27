import type { ExtendedTrack } from "@/types";
import {
  buildAutoplayAuthorKey,
  historyEntryFromTrack,
  isLowQualityAutoplayCandidate,
  isSimilarToHistoryEntry,
} from "@/utils/soundroomAutoplaySimilarity";

export type SoundroomAutoplayHistoryEntry = {
  titleKey: string;
  authorKey: string;
  uri: string | null;
  videoId: string | null;
  addedAt: number;
};

const MAX_HISTORY_PER_GUILD = 20;

const soundroomAutoplayHistoryByGuild = new Map<
  string,
  SoundroomAutoplayHistoryEntry[]
>();

export function recordSoundroomPlaybackHistory(
  guildId: string,
  track: ExtendedTrack,
): void {
  const entry = historyEntryFromTrack(track);
  if (!entry.titleKey && !entry.uri) {
    return;
  }

  let list = soundroomAutoplayHistoryByGuild.get(guildId);
  if (!list) {
    list = [];
    soundroomAutoplayHistoryByGuild.set(guildId, list);
  }

  const last = list[list.length - 1];
  if (last && isSimilarToHistoryEntry(last, entry)) {
    last.addedAt = entry.addedAt;
    if (entry.uri) {
      last.uri = entry.uri;
    }
    if (entry.videoId) {
      last.videoId = entry.videoId;
    }
    return;
  }

  list.push(entry);
  if (list.length > MAX_HISTORY_PER_GUILD) {
    list.splice(0, list.length - MAX_HISTORY_PER_GUILD);
  }
}

export function isAutoplayCandidateDuplicate(
  guildId: string,
  track: ExtendedTrack,
): boolean {
  const list = soundroomAutoplayHistoryByGuild.get(guildId);
  if (!list || list.length === 0) {
    return false;
  }
  const candidate = historyEntryFromTrack(track);
  for (const entry of list) {
    if (isSimilarToHistoryEntry(entry, candidate)) {
      return true;
    }
  }
  return false;
}

export function clearSoundroomAutoplayHistory(guildId: string): void {
  soundroomAutoplayHistoryByGuild.delete(guildId);
}

const WEAK_AUTHOR_KEYS = new Set([
  "topic",
  "various artists",
  "unknown",
]);

function isWeakAutoplayAuthorKey(authorKey: string): boolean {
  if (!authorKey) {
    return true;
  }
  if (WEAK_AUTHOR_KEYS.has(authorKey)) {
    return true;
  }
  return authorKey.includes(" topic");
}

export type AutoplayAuthorOveruse = "none" | "deprioritize" | "exclude";

/** 자동재생 후보만 — 사용자가 직접 넣은 곡에는 적용하지 않음 */
export function getAutoplayAuthorOveruse(
  guildId: string,
  author: string,
): AutoplayAuthorOveruse {
  const authorKey = buildAutoplayAuthorKey(author);
  if (isWeakAutoplayAuthorKey(authorKey)) {
    return "none";
  }
  const list = soundroomAutoplayHistoryByGuild.get(guildId);
  if (!list || list.length === 0) {
    return "none";
  }
  const last3 = list.slice(-3);
  const last5 = list.slice(-5);
  const in3 = last3.filter((e) => e.authorKey === authorKey).length;
  const in5 = last5.filter((e) => e.authorKey === authorKey).length;
  if (in5 >= 3) {
    return "exclude";
  }
  if (in3 >= 2) {
    return "deprioritize";
  }
  return "none";
}

export function scoreAutoplayCandidate(
  guildId: string,
  track: ExtendedTrack,
): number {
  if (isAutoplayCandidateDuplicate(guildId, track)) {
    return -1;
  }
  let score = 100;
  if (isLowQualityAutoplayCandidate(track)) {
    score -= 55;
  }
  const overuse = getAutoplayAuthorOveruse(
    guildId,
    track.info.author?.trim() ?? "",
  );
  if (overuse === "exclude") {
    return -1;
  }
  if (overuse === "deprioritize") {
    score -= 35;
  }
  return score;
}

export function pickBestAutoplayCandidate(
  guildId: string,
  candidates: ExtendedTrack[],
  excludeUri: string | null,
): ExtendedTrack | null {
  let best: ExtendedTrack | null = null;
  let bestScore = -1;

  for (const track of candidates) {
    const uri = track.info.uri?.trim();
    if (!uri) {
      continue;
    }
    if (excludeUri && uri === excludeUri) {
      continue;
    }
    const score = scoreAutoplayCandidate(guildId, track);
    if (score < 0) {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      best = track;
    }
  }

  return best;
}
