import type { MineClient } from "@/types";
import type { RiffyResolveOptions, RiffyResolveResponse } from "riffy";

const HTTP_URL_RE = /^https?:\/\//i;
const SEARCH_PREFIX_RE = /^[a-z][a-z0-9]*:/i;
const SPOTIFY_TRACK_RE = /open\.spotify\.com\/track\//i;

/** Riffy가 붙인 검색 접두사(ytsearch: 등)를 제거해 순수 검색어로 만듭니다. */
export function stripSearchEnginePrefix(query: string): string {
  const q = query.trim();
  const m = q.match(/^([a-z][a-z0-9]*):(.*)$/i);
  if (!m) {
    return q;
  }
  return m[2]?.trim() ?? q;
}

async function fetchSpotifyOembedTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { title?: string };
    const title = data.title?.trim();
    return title || null;
  } catch {
    return null;
  }
}

/** resolve에 넘기기 전 쿼리 정규화 (Spotify 단일 곡 → 제목 검색, 이중 접두사 제거). */
export async function normalizeRiffyResolveQuery(
  raw: string,
  _engine: string,
): Promise<string> {
  let q = raw.trim();
  if (!q) {
    return q;
  }
  if (HTTP_URL_RE.test(q) && SPOTIFY_TRACK_RE.test(q)) {
    const title = await fetchSpotifyOembedTitle(q);
    if (title) {
      return title;
    }
  }
  if (SEARCH_PREFIX_RE.test(q) && !HTTP_URL_RE.test(q)) {
    return stripSearchEnginePrefix(q);
  }
  return q;
}

/**
 * Riffy resolve 전에 Spotify 단일 곡·이중 검색 접두사를 정리합니다.
 * (잘못된 Spotify fallback은 patches/riffy+1.0.12.patch 에서 제거)
 */
export function patchRiffyResolve(client: MineClient): void {
  const riffy = client.riffy;
  const original = riffy.resolve.bind(riffy);

  riffy.resolve = async (
    options: RiffyResolveOptions,
  ): Promise<RiffyResolveResponse> => {
    const engine = client.config.engine?.trim() || "ytsearch";
    const query = await normalizeRiffyResolveQuery(options.query, engine);
    return original({ ...options, query });
  };
}
