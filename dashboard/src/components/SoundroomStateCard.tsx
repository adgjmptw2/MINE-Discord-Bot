import { formatDurationMs } from "../format";
import type { SoundroomGuildStateDto } from "../types";
import { QueueList } from "./QueueList";
import { SoundroomControls } from "./SoundroomControls";

type SoundroomStateCardProps = {
  guildId: string | null;
  state: SoundroomGuildStateDto | null;
  loading: boolean;
  error: string | null;
  onStateChange?: (state: SoundroomGuildStateDto) => void;
  onUnauthorized?: () => void;
  onSkipDone?: () => void;
};

function playbackStatus(state: SoundroomGuildStateDto): string {
  if (!state.soundroomConfigured) {
    return "—";
  }
  if (state.playing && state.paused) {
    return "일시정지";
  }
  if (state.playing) {
    return "재생 중";
  }
  if (state.paused) {
    return "일시정지";
  }
  return "대기";
}

function progressPercent(state: SoundroomGuildStateDto): number | null {
  const track = state.current;
  if (!track || track.isStream || track.durationMs == null || track.durationMs <= 0) {
    return null;
  }
  const pos = Math.max(0, state.positionMs);
  return Math.min(100, (pos / track.durationMs) * 100);
}

export function SoundroomStateCard({
  guildId,
  state,
  loading,
  error,
  onStateChange,
  onUnauthorized,
  onSkipDone,
}: SoundroomStateCardProps) {
  if (loading && !state) {
    return (
      <div className="state-card">
        <p className="muted">Soundroom 상태를 불러오는 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-card state-card--error">
        <p role="alert">{error}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="state-card">
        <p className="muted">서버를 선택하면 Soundroom 상태가 표시됩니다.</p>
      </div>
    );
  }

  if (!state.soundroomConfigured) {
    return (
      <div className="state-card">
        <p className="state-notice">
          이 서버에는 Soundroom이 아직 설정되지 않았습니다.
        </p>
        <p className="muted badge-line">Soundroom 미설정</p>
      </div>
    );
  }

  const current = state.current;
  const pct = progressPercent(state);

  return (
    <div className="state-card">
      <div className="state-meta-row">
        <span>볼륨 {Math.round(state.volume)}%</span>
        <span>자동재생 {state.autoplay ? "켜짐" : "꺼짐"}</span>
        <span>{playbackStatus(state)}</span>
        <span className="muted">갱신 {new Date(state.updatedAt).toLocaleString("ko-KR")}</span>
      </div>

      {current ? (
        <section className="now-playing">
          {current.thumbnailUrl ? (
            <img
              className="track-thumb"
              src={current.thumbnailUrl}
              alt=""
              width={160}
              height={160}
            />
          ) : (
            <div className="track-thumb track-thumb--empty" aria-hidden>
              ♪
            </div>
          )}
          <div className="track-info">
            <h2 className="track-title">{current.title}</h2>
            <p className="track-author">
              {current.author ?? "아티스트 알 수 없음"}
            </p>
            <p className="track-requester">
              신청: {current.requesterName ?? "알 수 없음"}
            </p>
            <p className="track-time">
              {current.isStream
                ? "LIVE"
                : `${formatDurationMs(state.positionMs)} / ${formatDurationMs(current.durationMs)}`}
            </p>
            <div
              className={`progress-bar${pct == null ? " progress-bar--disabled" : ""}`}
              role="progressbar"
              aria-valuenow={pct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-bar-fill"
                style={{ width: pct != null ? `${pct}%` : "0%" }}
              />
            </div>
            {current.durationMs == null && !current.isStream ? (
              <p className="muted">길이 알 수 없음</p>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="state-notice">현재 재생 중인 곡이 없습니다.</p>
      )}

      {guildId && onStateChange ? (
        <SoundroomControls
          guildId={guildId}
          state={state}
          disabled={loading}
          onStateChange={onStateChange}
          onUnauthorized={onUnauthorized}
          onSkipDone={onSkipDone}
        />
      ) : null}

      <section className="queue-section">
        <h3>대기열</h3>
        <QueueList queue={state.queue} />
      </section>
    </div>
  );
}
