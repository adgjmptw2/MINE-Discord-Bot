import type { ExtendedTrack } from "@/types";
import type { SoundroomAutoplayHistoryEntry } from "@/utils/soundroomAutoplayHistory";

const YT_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

/** 반복 방지용 heuristic — 완벽한 동일곡 판별이 아님 */
const TITLE_TAG_PATTERNS: RegExp[] = [
  /\s*[\[(（【][^\])）】]*(?:official|mv|audio|lyrics?|live|remaster(?:ed)?|nightcore|cover|topic|visualizer|sped\s*up|slowed|full\s*version|한글?자막|가사|자막|라이브|커버)[^\])）】]*[\])）】]\s*/gi,
  /\s*[-–—|]\s*(official\s*(?:video|mv|audio)?|lyrics?(?:\s*video)?|audio|mv|music\s*video|live|remaster(?:ed)?|nightcore|cover|topic|visualizer|sped\s*up|slowed|full\s*version)\s*$/gi,
  /\s*\(?\s*official\s*(?:video|mv|audio)?\s*\)?\s*$/gi,
  /\s*\(?\s*lyrics?(?:\s*video)?\s*\)?\s*$/gi,
];

export function normalizeAutoplayText(value: string): string {
  let t = value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const re of TITLE_TAG_PATTERNS) {
    t = t.replace(re, " ").replace(/\s+/g, " ").trim();
  }
  return t;
}

export function buildAutoplayTitleKey(title: string): string {
  const raw = title.trim();
  if (!raw) {
    return "";
  }
  const normalized = normalizeAutoplayText(raw);
  if (normalized.length >= 3) {
    return normalized;
  }
  return normalizeAutoplayText(raw.replace(/[^\p{L}\p{N}]+/gu, " "));
}

export function buildAutoplayAuthorKey(author: string): string {
  const normalized = normalizeAutoplayText(author.trim());
  if (normalized.length >= 2) {
    return normalized;
  }
  return "";
}

function youtubeHost(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

export function extractYouTubeVideoId(
  uri: string | null | undefined,
): string | null {
  const trimmed = uri?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const u = new URL(trimmed);
    const host = youtubeHost(u.hostname);
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (YT_HOSTS.has(host)) {
      const v = u.searchParams.get("v");
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractYouTubePlaylistId(
  uri: string | null | undefined,
): string | null {
  const trimmed = uri?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const u = new URL(trimmed);
    const host = youtubeHost(u.hostname);
    if (!YT_HOSTS.has(host)) {
      return null;
    }
    const list = u.searchParams.get("list");
    if (list && list.length >= 4) {
      return list;
    }
    if (host === "youtu.be") {
      const listShort = u.searchParams.get("list");
      return listShort && listShort.length >= 4 ? listShort : null;
    }
    if (u.pathname.startsWith("/playlist")) {
      const listPath = u.searchParams.get("list");
      return listPath && listPath.length >= 4 ? listPath : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** YouTube Mix / Radio 계열 playlist id (RD...) */
export function isYouTubeMixPlaylistId(listId: string | null): boolean {
  if (!listId) {
    return false;
  }
  return /^RD[A-Za-z0-9_-]+$/i.test(listId.trim());
}

export function isYouTubeRadioLikeUrl(
  uri: string | null | undefined,
): boolean {
  const trimmed = uri?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    const host = youtubeHost(u.hostname);
    if (!YT_HOSTS.has(host)) {
      return false;
    }
    if (u.searchParams.get("start_radio") === "1") {
      return true;
    }
    const listId = u.searchParams.get("list");
    return isYouTubeMixPlaylistId(listId);
  } catch {
    return false;
  }
}

export function historyEntryFromTrack(
  track: ExtendedTrack,
): SoundroomAutoplayHistoryEntry {
  const title = track.info.title?.trim() ?? "";
  const author = track.info.author?.trim() ?? "";
  const uri = track.info.uri?.trim() ?? null;
  return {
    titleKey: buildAutoplayTitleKey(title),
    authorKey: buildAutoplayAuthorKey(author),
    uri,
    videoId: extractYouTubeVideoId(uri),
    addedAt: Date.now(),
  };
}

export function isTitleTooSimilar(
  titleKeyA: string,
  titleKeyB: string,
): boolean {
  if (!titleKeyA || !titleKeyB) {
    return false;
  }
  if (titleKeyA === titleKeyB) {
    return true;
  }
  const minLen = Math.min(titleKeyA.length, titleKeyB.length);
  if (minLen < 4) {
    return false;
  }
  const longer =
    titleKeyA.length >= titleKeyB.length ? titleKeyA : titleKeyB;
  const shorter =
    titleKeyA.length >= titleKeyB.length ? titleKeyB : titleKeyA;
  if (!longer.includes(shorter)) {
    return false;
  }
  return shorter.length / longer.length >= 0.65;
}

function authorsSimilar(a: string, b: string): boolean {
  if (!a || !b) {
    return true;
  }
  if (a === b) {
    return true;
  }
  return a.includes(b) || b.includes(a);
}

const LOW_QUALITY_TITLE_RE =
  /\b(lyrics?|lyric\s*video|official\s*lyric|live|cover|reaction|1\s*hour|10\s*hours|loop|slowed|sped\s*up|nightcore|karaoke|instrumental|reupload|가사|자막|라이브|커버|노래방)\b/i;

export function isLowQualityAutoplayCandidate(track: ExtendedTrack): boolean {
  const title = track.info.title?.trim() ?? "";
  if (!title) {
    return false;
  }
  return LOW_QUALITY_TITLE_RE.test(title);
}

export function isSimilarToHistoryEntry(
  entry: SoundroomAutoplayHistoryEntry,
  candidate: SoundroomAutoplayHistoryEntry,
): boolean {
  if (entry.uri && candidate.uri && entry.uri === candidate.uri) {
    return true;
  }
  if (
    entry.videoId &&
    candidate.videoId &&
    entry.videoId === candidate.videoId
  ) {
    return true;
  }
  if (
    entry.titleKey &&
    candidate.titleKey &&
    entry.titleKey === candidate.titleKey &&
    authorsSimilar(entry.authorKey, candidate.authorKey)
  ) {
    return true;
  }
  if (
    isTitleTooSimilar(entry.titleKey, candidate.titleKey) &&
    authorsSimilar(entry.authorKey, candidate.authorKey)
  ) {
    return true;
  }
  return false;
}
