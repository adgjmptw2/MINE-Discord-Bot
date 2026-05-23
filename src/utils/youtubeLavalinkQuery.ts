const YT_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

function youtubeHost(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

export function sanitizeYoutubeQueryForLavalink(query: string): string {
  const q = query.trim();
  if (!q || !/^https?:\/\//i.test(q)) {
    return q;
  }
  let u: URL;
  try {
    u = new URL(q);
  } catch {
    return q;
  }
  const host = youtubeHost(u.hostname);
  if (!YT_HOSTS.has(host)) {
    return q;
  }

  if (host === "youtu.be") {
    const list = u.searchParams.get("list");
    if (list && /^RD/i.test(list)) {
      u.searchParams.delete("list");
    }
    u.searchParams.delete("start_radio");
    return u.toString();
  }

  if (u.pathname !== "/watch" && !u.pathname.startsWith("/watch/")) {
    return q;
  }

  const list = u.searchParams.get("list");
  if (list && /^RD/i.test(list)) {
    u.searchParams.delete("list");
  }
  u.searchParams.delete("start_radio");
  return u.toString();
}
