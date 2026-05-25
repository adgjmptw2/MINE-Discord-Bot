export function formatTrackDurationLabel(
  durationMs: number | null | undefined,
  isStream: boolean,
): string {
  if (isStream) {
    return "LIVE";
  }
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "길이 알 수 없음";
  }
  return formatDurationMs(durationMs);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function guildInitial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}
