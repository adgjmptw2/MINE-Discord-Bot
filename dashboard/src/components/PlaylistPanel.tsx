import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addPlaylistToQueue,
  createPlaylist,
  favoritePlaylist,
  getFavoritePlaylists,
  getMyPlaylists,
  getPlaylistDetail,
  getPublicPlaylists,
  unfavoritePlaylist,
} from "../api";
import { isControlUnauthorized, mapPlaylistError } from "../controlErrors";
import type {
  SoundroomGuildStateDto,
  WebPlaylistDetailDto,
  WebPlaylistFavoriteSummaryDto,
  WebPlaylistPublicSummaryDto,
  WebPlaylistSummaryDto,
} from "../types";
import { isStaleGuild } from "../utils/requestGuards";
import {
  FAVORITES_SORT_OPTIONS,
  filterFavoritePlaylists,
  filterMinePlaylists,
  MINE_SORT_OPTIONS,
  PUBLIC_SORT_OPTIONS,
  sortPlaylistRows,
  type PlaylistListEmptyKind,
  type PlaylistSortOption,
} from "../utils/playlistSort";
import { PlaylistAdminPanel } from "./PlaylistAdminPanel";
import { PlaylistDetail } from "./PlaylistDetail";
import { PlaylistEditor } from "./PlaylistEditor";
import { PlaylistList } from "./PlaylistList";
import { PlaylistListToolbar } from "./PlaylistListToolbar";

type Tab = "mine" | "public" | "favorites" | "admin";

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
const LIST_QUEUE_ADD_LIMIT = 50;

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
  const [publicSort, setPublicSort] = useState<PlaylistSortOption>("updatedDesc");
  const [favoritePlaylists, setFavoritePlaylists] = useState<
    WebPlaylistFavoriteSummaryDto[]
  >([]);
  const [favoritesHasMore, setFavoritesHasMore] = useState(false);
  const [mineSearch, setMineSearch] = useState("");
  const [mineSort, setMineSort] = useState<PlaylistSortOption>("updatedDesc");
  const [favoritesSearch, setFavoritesSearch] = useState("");
  const [favoritesSort, setFavoritesSort] =
    useState<PlaylistSortOption>("favoritedDesc");
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WebPlaylistDetailDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guildIdRef = useRef(guildId);
  const detailRequestId = useRef(0);

  useEffect(() => {
    guildIdRef.current = guildId;
  }, [guildId]);

  const displayedMine = useMemo(() => {
    const filtered = filterMinePlaylists(myPlaylists, mineSearch);
    return sortPlaylistRows(filtered, mineSort);
  }, [myPlaylists, mineSearch, mineSort]);

  const displayedPublic = useMemo(
    () => sortPlaylistRows(publicPlaylists, publicSort),
    [publicPlaylists, publicSort],
  );

  const displayedFavorites = useMemo(() => {
    const filtered = filterFavoritePlaylists(favoritePlaylists, favoritesSearch);
    return sortPlaylistRows(filtered, favoritesSort);
  }, [favoritePlaylists, favoritesSearch, favoritesSort]);

  const mineEmptyKind = useMemo((): PlaylistListEmptyKind => {
    if (myPlaylists.length === 0) {
      return "mine-empty";
    }
    return mineSearch.trim() ? "mine-search" : "mine-empty";
  }, [myPlaylists.length, mineSearch]);

  const publicEmptyKind = useMemo((): PlaylistListEmptyKind => {
    if (publicPlaylists.length === 0) {
      return publicQuery.trim() ? "public-search" : "public-empty";
    }
    return "public-empty";
  }, [publicPlaylists.length, publicQuery]);

  const favoritesEmptyKind = useMemo((): PlaylistListEmptyKind => {
    if (favoritePlaylists.length === 0) {
      return "favorites-empty";
    }
    return favoritesSearch.trim() ? "favorites-search" : "favorites-empty";
  }, [favoritePlaylists.length, favoritesSearch]);

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

  const fetchFavoritesList = useCallback(
    async (params: { offset: number; append: boolean }) => {
      setListLoading(true);
      setError(null);
      try {
        const res = await getFavoritePlaylists({
          limit: PUBLIC_PAGE_SIZE,
          offset: params.offset,
        });
        setFavoritePlaylists((prev) =>
          params.append ? [...prev, ...res.playlists] : res.playlists,
        );
        setFavoritesHasMore(res.playlists.length === PUBLIC_PAGE_SIZE);
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
    setNotice(null);
    if (next === "public" && publicPlaylists.length === 0) {
      void fetchPublicList({ q: publicQuery, offset: 0, append: false });
    }
    if (next === "favorites" && favoritePlaylists.length === 0) {
      void fetchFavoritesList({ offset: 0, append: false });
    }
  };

  const refreshListForTab = useCallback(() => {
    if (tab === "mine") {
      void loadMine();
    } else if (tab === "public") {
      void fetchPublicList({ q: publicQuery, offset: 0, append: false });
    } else if (tab === "favorites") {
      void fetchFavoritesList({ offset: 0, append: false });
    }
  }, [
    tab,
    loadMine,
    fetchPublicList,
    publicQuery,
    fetchFavoritesList,
  ]);

  const handleRefresh = () => {
    refreshListForTab();
    if (selectedId) {
      void loadDetail(selectedId);
    }
  };

  const handleFavoriteToggle = async (
    playlistId: string,
    isFavorited: boolean,
  ) => {
    setFavoriteBusyId(playlistId);
    setError(null);
    setNotice(null);
    onUserActionStart?.();
    try {
      if (isFavorited) {
        await unfavoritePlaylist(playlistId);
        setNotice("즐겨찾기에서 제거했습니다.");
        if (tab === "favorites" && selectedId === playlistId) {
          setDetail(null);
          setSelectedId(null);
        }
      } else {
        await favoritePlaylist(playlistId);
        setNotice("즐겨찾기에 추가했습니다.");
      }
      refreshListForTab();
      if (tab === "public") {
        setPublicPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, isFavorited: !isFavorited } : p,
          ),
        );
      }
      if (selectedId === playlistId && !(tab === "favorites" && isFavorited)) {
        await loadDetail(playlistId);
      }
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapPlaylistError(err));
    } finally {
      setFavoriteBusyId(null);
      onUserActionEnd?.();
    }
  };

  const handleFavoriteChangedFromDetail = () => {
    refreshListForTab();
  };

  /** 목록에서의 대기열 추가는 백엔드 권한·노래채널 검사 결과를 최종 신뢰한다. */
  const handleAddToQueueFromList = async (playlistId: string) => {
    if (!guildId || queueAddDisabled) {
      return;
    }
    setQueueBusyId(playlistId);
    setError(null);
    setNotice(null);
    onUserActionStart?.();
    try {
      const res = await addPlaylistToQueue(guildId, playlistId, {
        limit: LIST_QUEUE_ADD_LIMIT,
      });
      if (!isStaleGuild(guildId, guildIdRef.current)) {
        onStateChange(res.state);
      }
      const base = `플레이리스트에서 ${res.addedCount}곡을 대기열에 추가했습니다.`;
      setNotice(
        res.truncated ? `${base} 최대 ${res.limit}곡까지만 추가했습니다.` : base,
      );
      onAfterQueueChanged?.();
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapPlaylistError(err));
    } finally {
      setQueueBusyId(null);
      onUserActionEnd?.();
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

  const handlePublicSearchClear = () => {
    setPublicSearchInput("");
    setPublicQuery("");
    void fetchPublicList({ q: "", offset: 0, append: false });
  };

  const handleLoadMorePublic = () => {
    void fetchPublicList({
      q: publicQuery,
      offset: publicPlaylists.length,
      append: true,
    });
  };

  const listActionBusy = listLoading || Boolean(favoriteBusyId) || Boolean(queueBusyId);

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
          aria-selected={tab === "favorites"}
          className={`playlist-tab${tab === "favorites" ? " playlist-tab--active" : ""}`}
          onClick={() => handleTabChange("favorites")}
        >
          즐겨찾기
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

      {tab === "mine" ? (
        <PlaylistListToolbar
          searchValue={mineSearch}
          onSearchChange={setMineSearch}
          sort={mineSort}
          onSortChange={setMineSort}
          sortOptions={MINE_SORT_OPTIONS}
          placeholder="제목·설명·공개/비공개"
          searchDisabled={listLoading}
        />
      ) : null}

      {tab === "public" ? (
        <PlaylistListToolbar
          searchValue={publicSearchInput}
          onSearchChange={setPublicSearchInput}
          sort={publicSort}
          onSortChange={setPublicSort}
          sortOptions={PUBLIC_SORT_OPTIONS}
          placeholder="제목·설명 검색 (서버)"
          onSearchSubmit={handlePublicSearch}
          showSearchButton
          showClearButton={Boolean(publicQuery.trim() || publicSearchInput.trim())}
          onClear={handlePublicSearchClear}
          searchDisabled={listLoading}
        />
      ) : null}

      {tab === "favorites" ? (
        <PlaylistListToolbar
          searchValue={favoritesSearch}
          onSearchChange={setFavoritesSearch}
          sort={favoritesSort}
          onSortChange={setFavoritesSort}
          sortOptions={FAVORITES_SORT_OPTIONS}
          placeholder="제목·설명·만든이"
          searchDisabled={listLoading}
        />
      ) : null}

      {queueAddDisabled && queueAddDisabledReason && tab !== "admin" ? (
        <p className="playlist-disabled-hint muted">{queueAddDisabledReason}</p>
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
              items={displayedMine}
              selectedId={selectedId}
              onSelect={(id) => void loadDetail(id)}
              emptyKind={mineEmptyKind}
            />
          ) : null}
          {tab === "public" ? (
            <>
              <PlaylistList
                variant="public"
                items={displayedPublic}
                selectedId={selectedId}
                onSelect={(id) => void loadDetail(id)}
                emptyKind={publicEmptyKind}
                onFavoriteToggle={(id, fav) =>
                  void handleFavoriteToggle(id, fav)
                }
                favoriteBusyId={favoriteBusyId}
                queueAddDisabled={queueAddDisabled || !guildId}
                onAddToQueue={(id) => void handleAddToQueueFromList(id)}
                queueBusyId={queueBusyId}
              />
              {publicHasMore ? (
                <button
                  type="button"
                  className="btn btn-secondary playlist-load-more"
                  disabled={listActionBusy}
                  onClick={handleLoadMorePublic}
                >
                  더 보기
                </button>
              ) : null}
            </>
          ) : null}
          {tab === "favorites" ? (
            <div className="playlist-favorites-panel">
              <PlaylistList
                variant="favorites"
                items={displayedFavorites}
                selectedId={selectedId}
                onSelect={(id) => void loadDetail(id)}
                emptyKind={favoritesEmptyKind}
                onFavoriteToggle={(id, fav) =>
                  void handleFavoriteToggle(id, fav)
                }
                favoriteBusyId={favoriteBusyId}
                queueAddDisabled={queueAddDisabled || !guildId}
                onAddToQueue={(id) => void handleAddToQueueFromList(id)}
                queueBusyId={queueBusyId}
              />
              {favoritesHasMore ? (
                <button
                  type="button"
                  className="btn btn-secondary playlist-load-more"
                  disabled={listActionBusy}
                  onClick={() =>
                    void fetchFavoritesList({
                      offset: favoritePlaylists.length,
                      append: true,
                    })
                  }
                >
                  더 보기
                </button>
              ) : null}
            </div>
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
              onFavoriteChanged={handleFavoriteChangedFromDetail}
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

      {notice ? (
        <p className="playlist-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="playlist-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
