import {
  buildAutoplayAuthorKey,
  extractYouTubeVideoId,
} from "@/utils/soundroomAutoplaySimilarity";

const WEAK_AUTHOR_KEYS = new Set([
  "topic",
  "various artists",
  "unknown",
  "",
]);

/** 제목만 검색하면 official/audio 변형이 반복되므로 아티스트 radio/similar를 우선한다. */
export function isWeakAutoplayAuthor(author: string): boolean {
  const key = buildAutoplayAuthorKey(author);
  if (!key) {
    return true;
  }
  if (WEAK_AUTHOR_KEYS.has(key)) {
    return true;
  }
  return key.includes(" topic") || key.includes("auto generated");
}

export function normalizeAutoplayAuthor(author: string): string {
  return author
    .replace(/\s*-\s*topic\s*$/i, "")
    .replace(/\s*\(topic\)\s*$/i, "")
    .trim();
}

export function buildArtistRadioQueries(author: string): string[] {
  const name = normalizeAutoplayAuthor(author);
  if (!name || isWeakAutoplayAuthor(name)) {
    return [];
  }
  const safe = name.slice(0, 80);
  return [
    `ytsearch:${safe} radio`,
    `ytsearch:${safe} similar songs`,
    `ytsearch:${safe} mix`,
  ];
}

function cleanTitleForAutoplaySearch(title: string): string {
  let t = title.trim();
  if (!t) {
    return "";
  }
  t = t
    .replace(/\s*[\[(（【][^\])）】]*(?:official|mv|audio|lyrics?|live|remaster(?:ed)?|cover|topic|visualizer)[^\])）】]*[\])）】]\s*/gi, " ")
    .replace(/\s*[-–—|]\s*(official|lyrics?|audio|mv|live|cover)\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, 100);
}

export function buildYoutubeWatchUriForRadio(sourceUri: string): string | null {
  const id = extractYouTubeVideoId(sourceUri);
  if (!id) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

export function buildAutoplaySearchQueries(params: {
  sourceUri: string;
  mixPlaylistId: string | null;
  title: string | null;
  author: string | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    out.push(trimmed);
  };

  if (params.mixPlaylistId) {
    add(
      `https://www.youtube.com/playlist?list=${encodeURIComponent(params.mixPlaylistId)}`,
    );
  }

  for (const q of buildArtistRadioQueries(params.author ?? "")) {
    add(q);
  }

  const watch = buildYoutubeWatchUriForRadio(params.sourceUri);
  if (watch) {
    add(watch);
  }

  const title = params.title?.trim();
  if (title && !/^[a-z][a-z0-9]*:/i.test(title)) {
    const cleaned = cleanTitleForAutoplaySearch(title);
    if (cleaned) {
      add(`ytsearch:${cleaned}`);
    }
  }

  return out.slice(0, 5);
}
