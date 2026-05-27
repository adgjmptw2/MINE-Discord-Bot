import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPlaylist,
  getMyPlaylists,
  getPlaylistDetail,
  getPublicPlaylists,
} from "../api";
import { isControlUnauthorized, mapPlaylistError } from "../controlErrors";
import type {
  SoundroomGuildStateDto,
  WebPlaylistDetailDto,
  WebPlaylistPublicSummaryDto,
  WebPlaylistSummaryDto,
} from "../types";
import { isStaleGuild } from "../utils/requestGuards";
import { PlaylistAdminPanel } from "./PlaylistAdminPanel";
import { PlaylistDetail } from "./PlaylistDetail";
import { PlaylistEditor } from "./PlaylistEditor";
import { PlaylistList } from "./PlaylistList";

type Tab = "mine" | "public" | "admin";

type PlaylistPanelProps = {
  guildId: string | null;
  queueAddDisabled: boolean;
  queueAddDisabledReason: string | null;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onUnauthorized?: () => void;
  onAfterQueueChanged?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
};

const PUBLIC_PAGE_SIZE = 20;

export function PlaylistPanel({
  guildId,
  queueAddDisabled,
  queueAddDisabledReason,
  onStateChange,
  onUnauthorized,
  onAfterQueueChanged,
  onUserActionStart,
  onUserActionEnd,
}: PlaylistPanelProps) {
  const [tab, setTab] = useState<Tab>("mine");
  const [myPlaylists, setMyPlaylists] = useState<WebPlaylistSummaryDto[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<
    WebPlaylistPublicSummaryDto[]
  >([]);
  const [publicHasMore, setPublicHasMore] = useState(false);
  const [publicQuery, setPublicQuery] = useState("");
  const [publicSearchInput, setPublicSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WebPlaylistDetailDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guildIdRef = useRef(guildId);
  const detailRequestId = useRef(0);

  useEffect(() => {
    guildIdRef.current = guildId;
  }, [guildId]);

  const loadMine = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await getMyPlaylists();
      setMyPlaylists(res.playlists);
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapPlaylistError(err));
    } finally {
      setListLoading(false);
    }
  }, [onUnauthorized]);

  const fetchPublicList = useCallback(
    async (params: { q: string; offset: number; append: boolean }) => {
      setListLoading(true);
      setError(null);
      try {
        const res = await getPublicPlaylists({
          q: params.q || undefined,
          limit: PUBLIC_PAGE_SIZE,
          offset: params.offset,
        });
        setPublicPlaylists((prev) =>
          params.append ? [...prev, ...res.playlists] : res.playlists,
        );
        setPublicHasMore(res.playlists.length === PUBLIC_PAGE_SIZE);
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      } finally {
        setListLoading(false);
      }
    },
    [onUnauthorized],
  );

  const loadDetail = useCallback(
    async (playlistId: string) => {
      const reqId = ++detailRequestId.current;
      setDetailLoading(true);
      setError(null);
      try {
        const res = await getPlaylistDetail(playlistId);
        if (reqId !== detailRequestId.current) {
          return;
        }
        setDetail(res.playlist);
        setSelectedId(playlistId);
      } catch (err) {
        if (reqId !== detailRequestId.current) {
          return;
        }
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
        setDetail(null);
      } finally {
        if (reqId === detailRequestId.current) {
          setDetailLoading(false);
        }
      }
    },
    [onUnauthorized],
  );

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    setCreating(false);
  }, [guildId]);

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setSelectedId(null);
    setDetail(null);
    setCreating(false);
    setError(null);
    if (next === "public" && publicPlaylists.length === 0) {
      void fetchPublicList({ q: publicQuery, offset: 0, append: false });
    }
  };

  const handleRefresh = () => {
    if (tab === "mine") {
      void loadMine();
    } else if (tab === "public") {
      void fetchPublicList({ q: publicQuery, offset: 0, append: false });
    }
    if (selectedId) {
      void loadDetail(selectedId);
    }
  };

  const handleCreate = async (values: {
    title: string;
    description: string;
    visibility: "private" | "public";
  }) => {
    setBusy(true);
    setError(null);
    onUserActionStart?.();
    try {
      const res = await createPlaylist(values);
      setCreating(false);
      await loadMine();
      setTab("mine");
      await loadDetail(res.playlist.id);
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapPlaylistError(err));
    } finally {
      setBusy(false);
      onUserActionEnd?.();
    }
  };

  const handlePublicSearch = () => {
    const q = publicSearchInput.trim();
    setPublicQuery(q);
    void fetchPublicList({ q, offset: 0, append: false });
  };

  const handleLoadMorePublic = () => {
    void fetchPublicList({
      q: publicQuery,
      offset: publicPlaylists.length,
      append: true,
    });
  };

  return (
    <div className="playlist-panel">
      <div className="playlist-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          className={`playlist-tab${tab === "mine" ? " playlist-tab--active" : ""}`}
          onClick={() => handleTabChange("mine")}
        >
          내 플레이리스트
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "public"}
          className={`playlist-tab${tab === "public" ? " playlist-tab--active" : ""}`}
          onClick={() => handleTabChange("public")}
        >
          공개 플레이리스트
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "admin"}
          className={`playlist-tab playlist-tab--subtle${tab === "admin" ? " playlist-tab--active" : ""}`}
          onClick={() => handleTabChange("admin")}
        >
          운영자
        </button>
      </div>

      <div className="playlist-toolbar">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={listLoading || detailLoading || busy}
          onClick={handleRefresh}
        >
          새로고침
        </button>
        {tab === "mine" ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || creating}
            onClick={() => {
              setCreating(true);
              setDetail(null);
              setSelectedId(null);
            }}
          >
            새 플레이리스트
          </button>
        ) : null}
      </div>

      {tab === "public" ? (
        <div className="playlist-public-search">
          <input
            type="search"
            className="search-input"
            value={publicSearchInput}
            onChange={(e) => setPublicSearchInput(e.target.value)}
            placeholder="제목·설명 검색"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handlePublicSearch();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={listLoading}
            onClick={handlePublicSearch}
          >
            검색
          </button>
        </div>
      ) : null}

      {tab !== "admin" && listLoading && !detail ? (
        <p className="muted">목록을 불러오는 중…</p>
      ) : null}

      <div
        className={`playlist-layout${tab === "admin" ? " playlist-layout--admin" : ""}`}
      >
        <div className="playlist-layout-list">
          {tab === "mine" ? (
            <PlaylistList
              variant="mine"
              items={myPlaylists}
              selectedId={selectedId}
              onSelect={(id) => void loadDetail(id)}
            />
          ) : null}
          {tab === "public" ? (
            <>
              <PlaylistList
                variant="public"
                items={publicPlaylists}
                selectedId={selectedId}
                onSelect={(id) => void loadDetail(id)}
              />
              {publicHasMore ? (
                <button
                  type="button"
                  className="btn btn-secondary playlist-load-more"
                  disabled={listLoading}
                  onClick={handleLoadMorePublic}
                >
                  더 보기
                </button>
              ) : null}
            </>
          ) : null}
          {tab === "admin" ? (
            <PlaylistAdminPanel
              active={tab === "admin"}
              selectedId={selectedId}
              busy={busy}
              onSelect={(id) => void loadDetail(id)}
              onUnauthorized={onUnauthorized}
              onUserActionStart={onUserActionStart}
              onUserActionEnd={onUserActionEnd}
              onBusyChange={setBusy}
            />
          ) : null}
        </div>

        <div className="playlist-layout-detail">
          {creating ? (
            <div className="playlist-create">
              <h4>새 플레이리스트</h4>
              <PlaylistEditor
                mode="create"
                busy={busy}
                onSubmit={(values) => void handleCreate(values)}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : null}
          {detailLoading ? (
            <p className="muted">상세를 불러오는 중…</p>
          ) : null}
          {detail && !creating ? (
            <PlaylistDetail
              guildId={guildId}
              playlist={detail}
              queueAddDisabled={queueAddDisabled}
              queueAddDisabledReason={queueAddDisabledReason}
              onPlaylistChange={setDetail}
              onDeleted={() => {
                setDetail(null);
                setSelectedId(null);
                void loadMine();
              }}
              onStateChange={(newState) => {
                if (!isStaleGuild(guildId, guildIdRef.current)) {
                  onStateChange(newState);
                }
              }}
              onUnauthorized={onUnauthorized}
              onAfterQueueChanged={onAfterQueueChanged}
              onUserActionStart={onUserActionStart}
              onUserActionEnd={onUserActionEnd}
            />
          ) : null}
          {!detail && !creating && !detailLoading && !selectedId && tab !== "admin" ? (
            <p className="playlist-empty muted">플레이리스트를 선택하세요.</p>
          ) : null}
          {!detail && !creating && !detailLoading && !selectedId && tab === "admin" ? (
            <p className="playlist-empty muted">
              관리 목록에서 상세 보기를 선택하세요.
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="playlist-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
