import { db } from "@/storage/db";
import {
  type ParsedYoutubePlaylistInput,
  parseYoutubePlaylistInput,
} from "@/utils/youtubePlaylist";

export const BOT_GLOBAL_MELON_CHART_KEY = "__bot_global_melon__";

export interface MelonChartStoredSource {
  playlistUrl: string;
  priorityVideoId?: string;
}

interface MelonRow {
  playlist_url: string;
  priority_video_id: string | null;
}

export function getMelonChartSource(): MelonChartStoredSource | undefined {
  const row = db.get<MelonRow>(
    "SELECT playlist_url, priority_video_id FROM soundroom_chart_source WHERE guild_id = ?",
    [BOT_GLOBAL_MELON_CHART_KEY],
  );
  if (!row) {
    return undefined;
  }
  return {
    playlistUrl: row.playlist_url,
    priorityVideoId: row.priority_video_id ?? undefined,
  };
}

export function setMelonChartSource(
  rawUrl: string,
):
  | { ok: true; parsed: ParsedYoutubePlaylistInput }
  | { ok: false; message: string } {
  const parsed = parseYoutubePlaylistInput(rawUrl);
  if (!parsed) {
    return {
      ok: false,
      message:
        "유튜브 재생목록이 인식되지 않았습니다. `playlist?list=…` 주소이거나, 목록에 포함된 영상의 `watch?v=…&list=…` / `youtu.be/…?list=…` 링크를 넣어 주세요.",
    };
  }
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO soundroom_chart_source (guild_id, playlist_url, priority_video_id, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       playlist_url = excluded.playlist_url,
       priority_video_id = excluded.priority_video_id,
       updated_at = excluded.updated_at`,
    [
      BOT_GLOBAL_MELON_CHART_KEY,
      parsed.playlistUrl,
      parsed.priorityVideoId ?? null,
      now,
    ],
  );
  return { ok: true, parsed };
}

export function clearMelonChartSource(): void {
  db.run("DELETE FROM soundroom_chart_source WHERE guild_id = ?", [
    BOT_GLOBAL_MELON_CHART_KEY,
  ]);
}
