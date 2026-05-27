import { getCanModifyQueue, getSearchAddDisabledState } from "../controlErrors";
import { formatDurationMs } from "../format";
import type {
  SoundroomControlAction,
  SoundroomControlStatusResponseDto,
  SoundroomGuildStateDto,
} from "../types";
import { CollapsibleSection } from "./CollapsibleSection";

const SECTION_ADD_OPEN_KEY = "mine-dashboard:soundroom:section:add-song-open";
const SECTION_PLAYLIST_OPEN_KEY =
  "mine-dashboard:soundroom:section:playlists-open";
const SECTION_QUEUE_OPEN_KEY = "mine-dashboard:soundroom:section:queue-open";
import { PlaylistPanel } from "./PlaylistPanel";
import { QueueList } from "./QueueList";
import { SoundroomControls } from "./SoundroomControls";
import { SoundroomSearchPanel } from "./SoundroomSearchPanel";

type SoundroomStateCardProps = {
  guildId: string | null;
  state: SoundroomGuildStateDto | null;
  loading: boolean;
  error: string | null;
  controlStatus?: SoundroomControlStatusResponseDto | null;
  controlStatusLoading?: boolean;
  controlStatusError?: string | null;
  onStateChange?: (state: SoundroomGuildStateDto) => void;
  onControlSuccess?: (action: SoundroomControlAction) => void;
  onUnauthorized?: () => void;
  onSkipDone?: () => void;
  onSearchAdded?: () => void;
  onQueueChanged?: () => void;
  onRefreshPanel?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
  currentUserId?: string;
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
  controlStatus = null,
  controlStatusLoading = false,
  controlStatusError = null,
  onStateChange,
  onControlSuccess,
  onUnauthorized,
  onSkipDone,
  onSearchAdded,
  onQueueChanged,
  onRefreshPanel,
  onUserActionStart,
  onUserActionEnd,
  currentUserId,
}: SoundroomStateCardProps) {
  if (loading && !state) {
    return (
      <div className="state-card">
        <p className="muted">노래채널 상태를 불러오는 중…</p>
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
        <p className="muted">서버를 선택하면 노래채널 상태가 표시됩니다.</p>
      </div>
    );
  }

  if (!state.soundroomConfigured) {
    return (
      <div className="state-card">
        <p className="state-notice">
          이 서버에는 노래채널이 아직 설정되지 않았습니다.
        </p>
        <p className="muted badge-line">노래채널 미설정</p>
      </div>
    );
  }

  const current = state.current;
  const pct = progressPercent(state);
  const queueCount = state.queue.length;
  const searchDisabled = getSearchAddDisabledState(
    state.soundroomConfigured,
    controlStatusLoading,
    controlStatusError,
    controlStatus,
  );
  const queueModify = getCanModifyQueue(
    state.soundroomConfigured,
    controlStatusLoading,
    controlStatusError,
    controlStatus,
  );

  const queueSubtitle =
    queueCount > 0 ? `${queueCount}곡 대기 중` : "비어 있음";

  return (
    <div className="state-card">
      <div className="state-meta-row">
        <span>볼륨 {Math.round(state.volume)}%</span>
        <span>자동재생 {state.autoplay ? "켜짐" : "꺼짐"}</span>
        <span>{playbackStatus(state)}</span>
      </div>

      <section className="state-hero" aria-label="현재 재생">
        {current ? (
          <div className="now-playing">
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
          </div>
        ) : (
          <p className="state-notice">현재 재생 중인 곡이 없습니다.</p>
        )}
      </section>

      {guildId && onStateChange && state.soundroomConfigured ? (
        <div className="state-controls-wrap">
          <SoundroomControls
            guildId={guildId}
            state={state}
            controlStatus={controlStatus}
            controlStatusLoading={controlStatusLoading}
            controlStatusError={controlStatusError}
            disabled={loading}
            onStateChange={onStateChange}
            onControlSuccess={onControlSuccess}
            onUnauthorized={onUnauthorized}
            onSkipDone={onSkipDone}
            onUserActionStart={onUserActionStart}
            onUserActionEnd={onUserActionEnd}
          />
        </div>
      ) : null}

      {guildId && onStateChange ? (
        <CollapsibleSection
          title="노래 추가"
          subtitle="검색 · URL · 바로 추가"
          defaultOpen
          storageKey={SECTION_ADD_OPEN_KEY}
        >
          <SoundroomSearchPanel
            guildId={guildId}
            embedded
            disabled={searchDisabled.disabled || loading}
            disabledReason={searchDisabled.reason}
            onStateChange={onStateChange}
            onAdded={onSearchAdded}
            onUnauthorized={onUnauthorized}
            onUserActionStart={onUserActionStart}
            onUserActionEnd={onUserActionEnd}
          />
        </CollapsibleSection>
      ) : null}

      {guildId && onStateChange ? (
        <CollapsibleSection
          title="플레이리스트"
          subtitle="내 목록 · 공개 · 대기열 추가"
          defaultOpen={false}
          storageKey={SECTION_PLAYLIST_OPEN_KEY}
        >
          <PlaylistPanel
            guildId={guildId}
            queueAddDisabled={searchDisabled.disabled || loading}
            queueAddDisabledReason={searchDisabled.reason}
            onStateChange={onStateChange}
            onUnauthorized={onUnauthorized}
            onAfterQueueChanged={onSearchAdded}
            onUserActionStart={onUserActionStart}
            onUserActionEnd={onUserActionEnd}
          />
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="대기열"
        subtitle={queueSubtitle}
        defaultOpen={queueCount > 0}
        storageKey={SECTION_QUEUE_OPEN_KEY}
      >
        <QueueList
          queue={state.queue}
          guildId={guildId ?? ""}
          currentUserId={currentUserId ?? ""}
          canModifyQueue={Boolean(
            guildId &&
              onStateChange &&
              currentUserId &&
              queueModify.canModify &&
              !loading,
          )}
          disabledReason={queueModify.reason}
          onStateChange={onStateChange ?? (() => undefined)}
          onQueueChanged={onQueueChanged}
          onRefreshPanel={onRefreshPanel}
          onUnauthorized={onUnauthorized}
          onUserActionStart={onUserActionStart}
          onUserActionEnd={onUserActionEnd}
        />
      </CollapsibleSection>
    </div>
  );
}
