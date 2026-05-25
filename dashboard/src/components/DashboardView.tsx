import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  getGuilds,
  getSoundroomControlStatus,
  getSoundroomState,
  logout,
} from "../api";
import type {
  DiscordOAuthUserDto,
  SoundroomControlAction,
  SoundroomControlStatusResponseDto,
  SoundroomGuildStateDto,
  WebDashboardGuildDto,
} from "../types";
import { isStaleGuild } from "../utils/requestGuards";
import { ErrorState } from "./ErrorState";
import { GuildList } from "./GuildList";
import { LoadingState } from "./LoadingState";
import { RefreshStatus } from "./RefreshStatus";
import { SoundroomStateCard } from "./SoundroomStateCard";

const STORAGE_KEY = "mine_soundroom_selected_guild";
const POLL_MS = 8000;
const DELAYED_REFRESH_MS = 1500;

type DashboardViewProps = {
  user: DiscordOAuthUserDto;
  onLogout: () => void;
};

type RefreshOpts = {
  silent?: boolean;
  /** 조작 중에도 강제 갱신(수동 새로고침·충돌 복구) */
  force?: boolean;
};

function pickInitialGuild(
  guilds: WebDashboardGuildDto[],
): string | null {
  if (guilds.length === 0) {
    return null;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && guilds.some((g) => g.id === saved)) {
    return saved;
  }
  return guilds[0]!.id;
}

function mapStateError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 401) {
      return "로그인이 필요합니다.";
    }
    if (err.status === 403) {
      return "이 서버에 접근할 권한이 없습니다.";
    }
    if (err.status === 404) {
      return "봇이 해당 서버를 찾을 수 없습니다.";
    }
    if (err.status === 503) {
      return "웹 대시보드 인증이 비활성화되어 있습니다.";
    }
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

function mapControlStatusError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 401) {
      return "로그인이 필요합니다.";
    }
    return err.message || "조작 가능 여부를 확인할 수 없습니다.";
  }
  return "조작 가능 여부를 확인할 수 없습니다.";
}

export function DashboardView({ user, onLogout }: DashboardViewProps) {
  const [guilds, setGuilds] = useState<WebDashboardGuildDto[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildsError, setGuildsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<SoundroomGuildStateDto | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [controlStatus, setControlStatus] =
    useState<SoundroomControlStatusResponseDto | null>(null);
  const [controlStatusLoading, setControlStatusLoading] = useState(false);
  const [controlStatusError, setControlStatusError] = useState<string | null>(
    null,
  );
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [panelRefreshing, setPanelRefreshing] = useState(false);
  const [pollPaused, setPollPaused] = useState(false);

  const stateRequestId = useRef(0);
  const controlStatusRequestId = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const userActionDepthRef = useRef(0);
  const delayedRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const syncPollPaused = useCallback(() => {
    setPollPaused(userActionDepthRef.current > 0);
  }, []);

  const beginUserAction = useCallback(() => {
    userActionDepthRef.current += 1;
    syncPollPaused();
  }, [syncPollPaused]);

  const endUserAction = useCallback(() => {
    userActionDepthRef.current = Math.max(0, userActionDepthRef.current - 1);
    syncPollPaused();
  }, [syncPollPaused]);

  const clearDelayedRefresh = useCallback(() => {
    if (delayedRefreshTimerRef.current != null) {
      window.clearTimeout(delayedRefreshTimerRef.current);
      delayedRefreshTimerRef.current = null;
    }
  }, []);

  const displayName =
    user.globalName?.trim() || user.username?.trim() || "사용자";

  const loadGuilds = useCallback(async (signal?: AbortSignal) => {
    setGuildsLoading(true);
    setGuildsError(null);
    try {
      const res = await getGuilds(signal);
      setGuilds(res.guilds);
      setSelectedId((prev) => {
        if (prev && res.guilds.some((g) => g.id === prev)) {
          return prev;
        }
        return pickInitialGuild(res.guilds);
      });
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        onLogout();
        return;
      }
      setGuildsError(mapStateError(err));
      setGuilds([]);
    } finally {
      if (!signal?.aborted) {
        setGuildsLoading(false);
      }
    }
  }, [onLogout]);

  const loadState = useCallback(
    async (guildId: string, opts?: RefreshOpts) => {
      const id = ++stateRequestId.current;
      if (!opts?.silent) {
        setStateLoading(true);
      }
      setStateError(null);
      try {
        const res = await getSoundroomState(guildId);
        if (
          id !== stateRequestId.current ||
          isStaleGuild(guildId, selectedIdRef.current)
        ) {
          return;
        }
        setState(res.state);
      } catch (err) {
        if (
          id !== stateRequestId.current ||
          isStaleGuild(guildId, selectedIdRef.current)
        ) {
          return;
        }
        if (err instanceof ApiClientError && err.status === 401) {
          onLogout();
          return;
        }
        setStateError(mapStateError(err));
      } finally {
        if (id === stateRequestId.current && !opts?.silent) {
          setStateLoading(false);
        }
      }
    },
    [onLogout],
  );

  const loadControlStatus = useCallback(
    async (guildId: string, opts?: RefreshOpts) => {
      const id = ++controlStatusRequestId.current;
      if (!opts?.silent) {
        setControlStatusLoading(true);
      }
      setControlStatusError(null);
      try {
        const res = await getSoundroomControlStatus(guildId);
        if (
          id !== controlStatusRequestId.current ||
          isStaleGuild(guildId, selectedIdRef.current)
        ) {
          return;
        }
        setControlStatus(res);
      } catch (err) {
        if (
          id !== controlStatusRequestId.current ||
          isStaleGuild(guildId, selectedIdRef.current)
        ) {
          return;
        }
        if (err instanceof ApiClientError && err.status === 401) {
          onLogout();
          return;
        }
        setControlStatus(null);
        setControlStatusError(mapControlStatusError(err));
      } finally {
        if (id === controlStatusRequestId.current && !opts?.silent) {
          setControlStatusLoading(false);
        }
      }
    },
    [onLogout],
  );

  const refreshGuildPanel = useCallback(
    async (guildId: string, opts?: RefreshOpts) => {
      if (
        !opts?.force &&
        opts?.silent &&
        userActionDepthRef.current > 0
      ) {
        return;
      }

      const showSpinner = !opts?.silent;
      if (showSpinner) {
        setPanelRefreshing(true);
      }

      await Promise.all([
        loadState(guildId, { silent: true }),
        loadControlStatus(guildId, { silent: true }),
      ]);

      if (!isStaleGuild(guildId, selectedIdRef.current)) {
        setLastFetchedAt(new Date());
      }

      if (showSpinner) {
        setStateLoading(false);
        setControlStatusLoading(false);
        setPanelRefreshing(false);
      }
    },
    [loadState, loadControlStatus],
  );

  const scheduleDelayedRefresh = useCallback(
    (guildId: string) => {
      clearDelayedRefresh();
      delayedRefreshTimerRef.current = window.setTimeout(() => {
        delayedRefreshTimerRef.current = null;
        if (selectedIdRef.current === guildId) {
          void refreshGuildPanel(guildId, { silent: true });
        }
      }, DELAYED_REFRESH_MS);
    },
    [clearDelayedRefresh, refreshGuildPanel],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadGuilds(ac.signal);
    return () => ac.abort();
  }, [loadGuilds]);

  useEffect(() => {
    clearDelayedRefresh();
    if (!selectedId) {
      setState(null);
      setControlStatus(null);
      setControlStatusError(null);
      setLastFetchedAt(null);
      return;
    }
    localStorage.setItem(STORAGE_KEY, selectedId);
    void refreshGuildPanel(selectedId, { force: true });
  }, [selectedId, refreshGuildPanel, clearDelayedRefresh]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const tick = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (userActionDepthRef.current > 0) {
        return;
      }
      void refreshGuildPanel(selectedId, { silent: true });
    };

    const interval = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(interval);
  }, [selectedId, refreshGuildPanel]);

  useEffect(() => {
    return () => clearDelayedRefresh();
  }, [clearDelayedRefresh]);

  const handleSelectGuild = (guildId: string) => {
    setSelectedId(guildId);
  };

  const handleRefresh = () => {
    if (selectedId) {
      void refreshGuildPanel(selectedId, { force: true });
    }
  };

  const handleStateChange = (newState: SoundroomGuildStateDto) => {
    setState(newState);
    setStateError(null);
  };

  const handleControlSuccess = (action: SoundroomControlAction) => {
    if (
      selectedId &&
      (action === "stop" ||
        action === "skip" ||
        action === "toggleAutoplay")
    ) {
      void loadControlStatus(selectedId, { silent: true });
    }
    if (selectedId && (action === "skip" || action === "stop")) {
      scheduleDelayedRefresh(selectedId);
    }
  };

  const handleSkipDone = () => {
    const gid = selectedIdRef.current;
    if (gid) {
      scheduleDelayedRefresh(gid);
    }
  };

  const handleMutationFollowUp = () => {
    const gid = selectedIdRef.current;
    if (!gid) {
      return;
    }
    void loadControlStatus(gid, { silent: true });
    scheduleDelayedRefresh(gid);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* 세션 삭제 실패해도 로컬 UI는 로그아웃 처리 */
    }
    onLogout();
  };

  const panelBusy =
    panelRefreshing || stateLoading || controlStatusLoading;

  if (guildsLoading) {
    return <LoadingState label="서버 목록 불러오는 중…" />;
  }

  if (guildsError) {
    return (
      <ErrorState
        message={guildsError}
        onRetry={() => void loadGuilds()}
      />
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            노래채널 조작 가능 여부 · 8초마다 상태 자동 갱신
          </p>
          <h1>MINE 노래채널</h1>
        </div>
        <div className="user-bar">
          {user.avatarUrl ? (
            <img
              className="user-avatar"
              src={user.avatarUrl}
              alt=""
              width={36}
              height={36}
            />
          ) : null}
          <span className="user-name">{displayName}</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleLogout()}
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="guild-panel">
          <h2>서버</h2>
          <GuildList
            guilds={guilds}
            selectedId={selectedId}
            onSelect={handleSelectGuild}
          />
        </aside>

        <main className="state-panel">
          <div className="state-toolbar">
            <div className="state-toolbar-main">
              <h2>노래채널 상태</h2>
              <RefreshStatus
                loading={panelBusy}
                lastFetchedAt={lastFetchedAt}
                pollPaused={pollPaused}
                stateUpdatedAt={state?.updatedAt ?? null}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={!selectedId || panelBusy}
            >
              {panelBusy ? "갱신 중…" : "새로고침"}
            </button>
          </div>
          <SoundroomStateCard
            guildId={selectedId}
            state={state}
            loading={stateLoading}
            error={stateError}
            controlStatus={controlStatus}
            controlStatusLoading={controlStatusLoading}
            controlStatusError={controlStatusError}
            onStateChange={handleStateChange}
            onControlSuccess={handleControlSuccess}
            onUnauthorized={onLogout}
            onSkipDone={handleSkipDone}
            onSearchAdded={handleMutationFollowUp}
            onQueueChanged={handleMutationFollowUp}
            onRefreshPanel={handleRefresh}
            onUserActionStart={beginUserAction}
            onUserActionEnd={endUserAction}
            currentUserId={user.id}
          />
        </main>
      </div>
    </div>
  );
}
