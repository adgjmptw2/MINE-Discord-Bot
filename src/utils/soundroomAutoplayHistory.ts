import type { ExtendedTrack } from "@/types";
import {
  historyEntryFromTrack,
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
