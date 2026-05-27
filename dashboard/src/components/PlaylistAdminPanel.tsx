import { useCallback, useEffect, useState } from "react";
import { getAdminPublicPlaylists, setPlaylistAdminHidden } from "../api";
import { PlaylistReportsPanel } from "./PlaylistReportsPanel";
import {
  isControlUnauthorized,
  isPlaylistAdminRequired,
  mapPlaylistError,
} from "../controlErrors";
import type {
  WebPlaylistAdminListHiddenFilter,
  WebPlaylistAdminSummaryDto,
} from "../types";

type PlaylistAdminPanelProps = {
  active: boolean;
  selectedId: string | null;
  busy: boolean;
  onSelect: (playlistId: string) => void;
  onUnauthorized?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

const PAGE_SIZE = 20;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type AdminSection = "playlists" | "reports";

export function PlaylistAdminPanel({
  active,
  selectedId,
  busy,
  onSelect,
  onUnauthorized,
  onUserActionStart,
  onUserActionEnd,
  onBusyChange,
}: PlaylistAdminPanelProps) {
  const [section, setSection] = useState<AdminSection>("playlists");
  const [accessDenied, setAccessDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<WebPlaylistAdminSummaryDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [hiddenFilter, setHiddenFilter] =
    useState<WebPlaylistAdminListHiddenFilter>("all");
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchList = useCallback(
    async (opts: {
      reset: boolean;
      q?: string;
      hidden?: WebPlaylistAdminListHiddenFilter;
      offset?: number;
    }) => {
      setListLoading(true);
      setError(null);
      const q = opts.q ?? query;
      const hidden = opts.hidden ?? hiddenFilter;
      const offset = opts.reset ? 0 : (opts.offset ?? 0);
      try {
        const res = await getAdminPublicPlaylists({
          q: q || undefined,
          hidden,
          limit: PAGE_SIZE,
          offset,
        });
        setAccessDenied(false);
        setLoaded(true);
        setItems((prev) =>
          opts.reset ? res.playlists : [...prev, ...res.playlists],
        );
        setHasMore(res.playlists.length === PAGE_SIZE);
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        if (isPlaylistAdminRequired(err)) {
          setAccessDenied(true);
          setLoaded(true);
          setItems([]);
          return;
        }
        setError(mapPlaylistError(err));
      } finally {
        setListLoading(false);
      }
    },
    [hiddenFilter, onUnauthorized, query],
  );

  useEffect(() => {
    if (active && !loaded && !accessDenied && !listLoading) {
      void fetchList({ reset: true });
    }
  }, [active, accessDenied, fetchList, listLoading, loaded]);

  const handleSearch = () => {
    const q = searchInput.trim();
    setQuery(q);
    void fetchList({ reset: true, q });
  };

  const handleFilterChange = (hidden: WebPlaylistAdminListHiddenFilter) => {
    setHiddenFilter(hidden);
    void fetchList({ reset: true, hidden });
  };

  const runHideAction = async (playlistId: string, hidden: boolean) => {
    const msg = hidden
      ? "이 공개 플레이리스트를 공개 목록에서 숨길까요?"
      : "이 플레이리스트를 다시 공개 목록에 표시할까요?";
    if (!window.confirm(msg)) {
      return;
    }
    setError(null);
    setNotice(null);
    onBusyChange?.(true);
    onUserActionStart?.();
    try {
      await setPlaylistAdminHidden(playlistId, hidden);
      setNotice(hidden ? "공개 목록에서 숨겼습니다." : "다시 표시했습니다.");
      void fetchList({ reset: true });
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      if (isPlaylistAdminRequired(err)) {
        setAccessDenied(true);
        return;
      }
      setError(mapPlaylistError(err));
    } finally {
      onBusyChange?.(false);
      onUserActionEnd?.();
    }
  };

  if (accessDenied) {
    return (
      <p className="playlist-admin-warning muted" role="status">
        운영자 권한이 필요합니다.
      </p>
    );
  }

  return (
    <div className="playlist-admin-panel">
      <div className="playlist-admin-section-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={section === "playlists"}
          className={`playlist-tab playlist-tab--compact${section === "playlists" ? " playlist-tab--active" : ""}`}
          onClick={() => setSection("playlists")}
        >
          공개 관리
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "reports"}
          className={`playlist-tab playlist-tab--compact${section === "reports" ? " playlist-tab--active" : ""}`}
          onClick={() => setSection("reports")}
        >
          신고 목록
        </button>
      </div>

      {section === "reports" ? (
        <PlaylistReportsPanel
          active={active && section === "reports"}
          busy={busy}
          onSelectPlaylist={onSelect}
          onUnauthorized={onUnauthorized}
          onUserActionStart={onUserActionStart}
          onUserActionEnd={onUserActionEnd}
          onBusyChange={onBusyChange}
        />
      ) : null}

      {section === "playlists" ? (
        <>
      <p className="playlist-admin-intro muted">
        운영자는 공개 플레이리스트를 숨김 처리하거나 다시 표시할 수 있습니다.
        숨김은 삭제가 아니며 일반 공개 목록에서만 제외됩니다.
      </p>

      <div className="playlist-admin-toolbar">
        <input
          type="search"
          className="search-input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="제목·설명·작성자 검색"
          maxLength={100}
          disabled={listLoading || busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={listLoading || busy}
          onClick={handleSearch}
        >
          검색
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={listLoading || busy}
          onClick={() => void fetchList({ reset: true })}
        >
          새로고침
        </button>
      </div>

      <div className="playlist-admin-filter" role="group" aria-label="숨김 필터">
        {(
          [
            ["all", "전체"],
            ["visible", "표시 중"],
            ["hidden", "숨김"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`playlist-tab playlist-tab--compact${hiddenFilter === value ? " playlist-tab--active" : ""}`}
            disabled={listLoading || busy}
            onClick={() => handleFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {listLoading && items.length === 0 ? (
        <p className="muted">관리 목록을 불러오는 중…</p>
      ) : null}

      {items.length === 0 && loaded && !listLoading ? (
        <p className="playlist-empty muted">표시할 공개 플레이리스트가 없습니다.</p>
      ) : null}

      <ul className="playlist-list playlist-admin-list">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <article
                className={`playlist-admin-card${selected ? " playlist-admin-card--selected" : ""}`}
              >
                <div className="playlist-admin-card-head">
                  <p className="playlist-card-title">{item.title}</p>
                  {item.isHiddenByAdmin ? (
                    <span className="playlist-admin-badge">숨김</span>
                  ) : (
                    <span className="playlist-admin-badge playlist-admin-badge--visible">
                      표시 중
                    </span>
                  )}
                </div>
                {item.description ? (
                  <p className="playlist-card-desc muted">{item.description}</p>
                ) : null}
                <p className="playlist-card-meta muted">
                  {item.ownerNameSnapshot} · {item.trackCount}곡 · 수정{" "}
                  {formatUpdatedAt(item.updatedAt)}
                </p>
                <div className="playlist-admin-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy || listLoading}
                    onClick={() => onSelect(item.id)}
                  >
                    상세 보기
                  </button>
                  {item.isHiddenByAdmin ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy || listLoading}
                      onClick={() => void runHideAction(item.id, false)}
                    >
                      숨김 해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy || listLoading}
                      onClick={() => void runHideAction(item.id, true)}
                    >
                      숨김 처리
                    </button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <button
          type="button"
          className="btn btn-secondary playlist-load-more"
          disabled={listLoading || busy}
          onClick={() => void fetchList({ reset: false, offset: items.length })}
        >
          더 보기
        </button>
      ) : null}

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
        </>
      ) : null}
    </div>
  );
}
