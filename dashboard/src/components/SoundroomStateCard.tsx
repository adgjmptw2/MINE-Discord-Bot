import { useCallback, useState } from "react";
import { getCanModifyQueue, getSearchAddDisabledState } from "../controlErrors";
import { formatDurationMs } from "../format";
import type {
  SoundroomControlAction,
  SoundroomControlStatusResponseDto,
  SoundroomGuildStateDto,
} from "../types";
import {
  readStringPreference,
  writeStringPreference,
} from "../utils/storage";
import { PlaylistPanel } from "./PlaylistPanel";
import { QueueList } from "./QueueList";
import {
  SoundroomWorkspaceTabs,
  type SoundroomWorkspaceTab,
} from "./SoundroomWorkspaceTabs";
import { SoundroomControls } from "./SoundroomControls";
import { SoundroomSearchPanel } from "./SoundroomSearchPanel";

const WORKSPACE_TAB_KEY = "mine-dashboard:soundroom:workspace-tab";

function resolveWorkspaceTab(): SoundroomWorkspaceTab {
  const saved = readStringPreference(WORKSPACE_TAB_KEY);
  if (saved === "add" || saved === "playlist" || saved === "queue") {
    return saved;
  }
  return "add";
}

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
  const [workspaceTab, setWorkspaceTab] =
    useState<SoundroomWorkspaceTab>(resolveWorkspaceTab);

  const changeWorkspaceTab = useCallback((tab: SoundroomWorkspaceTab) => {
    setWorkspaceTab(tab);
    writeStringPreference(WORKSPACE_TAB_KEY, tab);
  }, []);

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

  return (
    <div className="state-card soundroom-main-card">
      <section className="soundroom-hero" aria-label="현재 재생">
        <div className="soundroom-hero-stats">
          <span className="soundroom-stat-chip">{playbackStatus(state)}</span>
          <span className="soundroom-stat-chip">
            볼륨 {Math.round(state.volume)}%
          </span>
          <span className="soundroom-stat-chip">
            자동재생 {state.autoplay ? "켜짐" : "꺼짐"}
          </span>
          <span className="soundroom-stat-chip">
            대기열 {queueCount}곡
          </span>
        </div>

        {current ? (
          <div className="now-playing soundroom-hero-now">
            <div className="soundroom-hero-art">
              {current.thumbnailUrl ? (
                <img
                  className="track-thumb track-thumb--hero"
                  src={current.thumbnailUrl}
                  alt=""
                  width={200}
                  height={200}
                />
              ) : (
                <div
                  className="track-thumb track-thumb--hero track-thumb--empty"
                  aria-hidden
                >
                  ♪
                </div>
              )}
            </div>
            <div className="track-info soundroom-hero-meta">
              <h2 className="track-title track-title--hero">{current.title}</h2>
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
                className={`progress-bar progress-bar--hero${pct == null ? " progress-bar--disabled" : ""}`}
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
          <div className="soundroom-hero-empty">
            <p className="soundroom-hero-empty-title">대기 중</p>
            <p className="muted">
              노래를 추가하거나 플레이리스트를 불러오세요.
            </p>
          </div>
        )}
      </section>

      {guildId && onStateChange && state.soundroomConfigured ? (
        <div className="state-controls-wrap soundroom-controls-wrap">
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
        <SoundroomWorkspaceTabs
          activeTab={workspaceTab}
          onTabChange={changeWorkspaceTab}
          queueCount={queueCount}
          addPanel={
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
          }
          playlistPanel={
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
          }
          queuePanel={
            <QueueList
              queue={state.queue}
              guildId={guildId}
              currentUserId={currentUserId ?? ""}
              canModifyQueue={Boolean(
                currentUserId &&
                  queueModify.canModify &&
                  !loading,
              )}
              disabledReason={queueModify.reason}
              onStateChange={onStateChange}
              onQueueChanged={onQueueChanged}
              onRefreshPanel={onRefreshPanel}
              onUnauthorized={onUnauthorized}
              onUserActionStart={onUserActionStart}
              onUserActionEnd={onUserActionEnd}
            />
          }
        />
      ) : null}
    </div>
  );
}
