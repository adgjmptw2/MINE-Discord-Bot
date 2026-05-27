import { formatTrackDurationLabel } from "../format";
import type { WebPlaylistTrackDto } from "../types";

type PlaylistTrackListProps = {
  tracks: WebPlaylistTrackDto[];
  canManage: boolean;
  busy?: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (trackId: string) => void;
};

export function PlaylistTrackList({
  tracks,
  canManage,
  busy = false,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PlaylistTrackListProps) {
  if (tracks.length === 0) {
    return <p className="playlist-empty muted">저장된 곡이 없습니다.</p>;
  }

  return (
    <ul className="playlist-track-list">
      {tracks.map((track, index) => (
        <li key={track.id} className="playlist-track-item">
          <div className="playlist-track-main">
            {track.thumbnailUrl ? (
              <img
                className="playlist-track-thumb"
                src={track.thumbnailUrl}
                alt=""
                width={48}
                height={48}
              />
            ) : (
              <div className="playlist-track-thumb playlist-track-thumb--empty" aria-hidden>
                ♪
              </div>
            )}
            <div className="playlist-track-body">
              <p className="playlist-track-title" title={track.title}>
                {track.title}
              </p>
              <p className="playlist-track-meta muted">
                {track.author || "아티스트 알 수 없음"}
                {" · "}
                {formatTrackDurationLabel(track.durationMs, false)}
              </p>
            </div>
          </div>
          {canManage ? (
            <div className="playlist-track-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || index === 0}
                onClick={() => onMoveUp(index)}
                aria-label="위로"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || index === tracks.length - 1}
                onClick={() => onMoveDown(index)}
                aria-label="아래로"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busy}
                onClick={() => onRemove(track.id)}
              >
                삭제
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
