import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AttachmentBuilder } from "discord.js";
import { formatDuration } from "@/utils/discord";
import type { ExtendedTrack } from "@/types";

export const SOUNDROOM_IDLE_ATTACHMENT_NAME = "soundroom-idle.gif";

export function getSoundroomIdleImageUrlFromEnv(): string | null {
  const raw = process.env.SOUNDROOM_IDLE_GIF_URL?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return null;
  }
  return raw;
}

export function tryLoadSoundroomIdleAttachment(): AttachmentBuilder | null {
  if (getSoundroomIdleImageUrlFromEnv()) {
    return null;
  }
  const p = path.join(
    process.cwd(),
    "docs",
    "mine_soundroom_logo_loop_480.gif",
  );
  if (!existsSync(p)) {
    return null;
  }
  try {
    const buf = readFileSync(p);
    return new AttachmentBuilder(buf, { name: SOUNDROOM_IDLE_ATTACHMENT_NAME });
  } catch {
    return null;
  }
}

export function extractYoutubeVideoId(uri: string): string | null {
  const t = uri.trim();
  if (!t) {
    return null;
  }
  try {
    const u = new URL(t);
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (h === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (h === "youtube.com" || h === "m.youtube.com" || h === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) {
        return v;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveSoundroomPlayingImageUrl(
  track: ExtendedTrack,
): string | null {
  const art = track.info.artworkUrl?.trim();
  if (art && /^https?:\/\//i.test(art)) {
    return art;
  }
  const uri = track.info.uri ?? "";
  const sn = (track.info.sourceName ?? "").toLowerCase();
  const yt =
    sn.includes("youtube") ||
    uri.includes("youtube.com") ||
    uri.includes("youtu.be");
  if (!yt) {
    return null;
  }
  const fromUri = extractYoutubeVideoId(uri);
  const idRaw = track.info.identifier?.trim() ?? "";
  const fromIdent = /^[\w-]{11}$/.test(idRaw) ? idRaw : null;
  const id = fromUri ?? fromIdent;
  if (!id) {
    return null;
  }
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

export function resolveSoundroomPanelPlayingImage(
  track: ExtendedTrack,
): { imageUrl: string | null; files: AttachmentBuilder[] } {
  let imageUrl = resolveSoundroomPlayingImageUrl(track);
  if (imageUrl) {
    return { imageUrl, files: [] };
  }
  imageUrl = getSoundroomIdleImageUrlFromEnv();
  if (imageUrl) {
    return { imageUrl, files: [] };
  }
  const att = tryLoadSoundroomIdleAttachment();
  if (att) {
    return {
      imageUrl: `attachment://${SOUNDROOM_IDLE_ATTACHMENT_NAME}`,
      files: [att],
    };
  }
  return { imageUrl: null, files: [] };
}

export function formatSoundroomProgress(
  currentMs: number,
  durationMs: number,
  isStream?: boolean,
): string {
  if (isStream) {
    return "▰▰▰▰▰ LIVE";
  }
  const total = durationMs > 0 ? durationMs : 1;
  const width = 8;
  const ratio = Math.max(0, Math.min(1, currentMs / total));
  const filled = Math.round(ratio * width);
  const on = Math.max(0, Math.min(width, filled));
  const bar = `${"▰".repeat(on)}${"▱".repeat(width - on)}`;
  return `${bar} ${formatDuration(currentMs)} / ${formatDuration(total)}`;
}
