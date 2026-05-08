import type { ExtendedTrack } from "@/types";

export interface ParsedYoutubePlaylistInput {
  playlistUrl: string;
  /** `watch?v=` 또는 `youtu.be/` 에서 넣은 곡을 먼저 재생 */
  priorityVideoId?: string;
}

/**
 * 재생목록 URL 또는 `watch?v=…&list=…` / `youtu.be/…?list=…` 형태에서
 * 정규화된 playlist URL과 우선 재생할 영상 ID를 뽑습니다.
 */
export function parseYoutubePlaylistInput(
  raw: string,
): ParsedYoutubePlaylistInput | null {
  const trimmed = raw.trim();
  const listMatch = trimmed.match(/[?&]list=([\w-]{10,})/i);
  if (!listMatch) {
    return null;
  }
  const listId = listMatch[1];
  const playlistUrl = `https://www.youtube.com/playlist?list=${listId}`;

  let priorityVideoId: string | undefined;
  const vParam = trimmed.match(/[?&]v=([\w-]{11})/i);
  if (vParam) {
    priorityVideoId = vParam[1];
  } else {
    const short = trimmed.match(/youtu\.be\/([\w-]{11})/i);
    if (short) {
      priorityVideoId = short[1];
    }
  }

  return { playlistUrl, priorityVideoId };
}

/** `priorityVideoId`에 해당하는 트랙을 맨 앞으로 옮깁니다. */
export function prioritizeYoutubeTracks(
  tracks: ExtendedTrack[],
  priorityVideoId: string | undefined,
): ExtendedTrack[] {
  if (!priorityVideoId || tracks.length < 2) {
    return tracks;
  }
  const id = priorityVideoId.trim();
  if (!id) {
    return tracks;
  }
  const idx = tracks.findIndex((t) => {
    const uri = t.info.uri ?? "";
    const ident = t.info.identifier ?? "";
    return uri.includes(id) || ident === id || ident.endsWith(id);
  });
  if (idx <= 0) {
    return tracks;
  }
  const copy = [...tracks];
  const [chosen] = copy.splice(idx, 1);
  return chosen ? [chosen, ...copy] : tracks;
}
