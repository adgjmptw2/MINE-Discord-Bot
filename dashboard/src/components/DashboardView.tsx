import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  getGuilds,
  getSoundroomState,
  logout,
} from "../api";
import type {
  DiscordOAuthUserDto,
  SoundroomGuildStateDto,
  WebDashboardGuildDto,
} from "../types";
import { ErrorState } from "./ErrorState";
import { GuildList } from "./GuildList";
import { LoadingState } from "./LoadingState";
import { SoundroomStateCard } from "./SoundroomStateCard";

const STORAGE_KEY = "mine_soundroom_selected_guild";
const POLL_MS = 8000;

type DashboardViewProps = {
  user: DiscordOAuthUserDto;
  onLogout: () => void;
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

export function DashboardView({ user, onLogout }: DashboardViewProps) {
  const [guilds, setGuilds] = useState<WebDashboardGuildDto[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildsError, setGuildsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<SoundroomGuildStateDto | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const stateRequestId = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
    async (guildId: string, opts?: { silent?: boolean }) => {
      const id = ++stateRequestId.current;
      if (!opts?.silent) {
        setStateLoading(true);
      }
      setStateError(null);
      try {
        const res = await getSoundroomState(guildId);
        if (id !== stateRequestId.current) {
          return;
        }
        setState(res.state);
      } catch (err) {
        if (id !== stateRequestId.current) {
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

  useEffect(() => {
    const ac = new AbortController();
    void loadGuilds(ac.signal);
    return () => ac.abort();
  }, [loadGuilds]);

  useEffect(() => {
    if (!selectedId) {
      setState(null);
      return;
    }
    localStorage.setItem(STORAGE_KEY, selectedId);
    void loadState(selectedId);
  }, [selectedId, loadState]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const tick = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void loadState(selectedId, { silent: true });
    };

    const interval = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(interval);
  }, [selectedId, loadState]);

  const handleSelectGuild = (guildId: string) => {
    setSelectedId(guildId);
  };

  const handleRefresh = () => {
    if (selectedId) {
      void loadState(selectedId);
    }
  };

  const handleStateChange = (newState: SoundroomGuildStateDto) => {
    setState(newState);
    setStateError(null);
  };

  const handleSkipDone = () => {
    const gid = selectedIdRef.current;
    if (!gid) {
      return;
    }
    window.setTimeout(() => {
      if (selectedIdRef.current === gid) {
        void loadState(gid, { silent: true });
      }
    }, 1500);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* 세션 삭제 실패해도 로컬 UI는 로그아웃 처리 */
    }
    onLogout();
  };

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
            같은 음성 채널에서 Soundroom 조작 · 8초마다 상태 자동 갱신
          </p>
          <h1>MINE Soundroom</h1>
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
            <h2>Soundroom 상태</h2>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={!selectedId || stateLoading}
            >
              새로고침
            </button>
          </div>
          <SoundroomStateCard
            guildId={selectedId}
            state={state}
            loading={stateLoading}
            error={stateError}
            onStateChange={handleStateChange}
            onUnauthorized={onLogout}
            onSkipDone={handleSkipDone}
          />
        </main>
      </div>
    </div>
  );
}
