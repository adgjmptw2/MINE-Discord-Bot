import type { MineClient } from "@/types";
import type { RiffyResolveOptions, RiffyResolveResponse } from "riffy";

const HTTP_URL_RE = /^https?:\/\//i;
const SEARCH_PREFIX_RE = /^[a-z][a-z0-9]*:/i;
const SPOTIFY_TRACK_RE = /open\.spotify\.com\/track\//i;

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
