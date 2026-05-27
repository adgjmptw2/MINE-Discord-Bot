import { useCallback, useEffect, useState } from "react";
import {
  getAdminPlaylistReports,
  resolvePlaylistReport,
  setPlaylistAdminHidden,
} from "../api";
import {
  isControlUnauthorized,
  isPlaylistAdminRequired,
  mapPlaylistError,
} from "../controlErrors";
import { playlistReportReasonLabel } from "../playlistReportLabels";
import type {
  WebPlaylistAdminReportStatusFilter,
  WebPlaylistAdminReportSummaryDto,
} from "../types";

type PlaylistReportsPanelProps = {
  active: boolean;
  busy: boolean;
  onSelectPlaylist: (playlistId: string) => void;
  onUnauthorized?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

const PAGE_SIZE = 20;

function formatTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function PlaylistReportsPanel({
  active,
  busy,
  onSelectPlaylist,
  onUnauthorized,
  onUserActionStart,
  onUserActionEnd,
  onBusyChange,
}: PlaylistReportsPanelProps) {
  const [accessDenied, setAccessDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<WebPlaylistAdminReportSummaryDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<WebPlaylistAdminReportStatusFilter>("open");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});

  const fetchList = useCallback(
    async (opts: {
      reset: boolean;
      status?: WebPlaylistAdminReportStatusFilter;
      q?: string;
      offset?: number;
    }) => {
      setListLoading(true);
      setError(null);
      const status = opts.status ?? statusFilter;
      const q = opts.q ?? query;
      const offset = opts.reset ? 0 : (opts.offset ?? 0);
      try {
        const res = await getAdminPlaylistReports({
          status,
          q: q || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        setAccessDenied(false);
        setLoaded(true);
        setItems((prev) =>
          opts.reset ? res.reports : [...prev, ...res.reports],
        );
        setHasMore(res.reports.length === PAGE_SIZE);
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
    [onUnauthorized, query, statusFilter],
  );

  useEffect(() => {
    if (active && !loaded && !accessDenied && !listLoading) {
      void fetchList({ reset: true });
    }
  }, [active, accessDenied, fetchList, listLoading, loaded]);

  const runAction = async (fn: () => Promise<void>) => {
    onBusyChange?.(true);
    onUserActionStart?.();
    setError(null);
    try {
      await fn();
    } finally {
      onBusyChange?.(false);
      onUserActionEnd?.();
    }
  };

  const handleHide = (playlistId: string, hidden: boolean) => {
    const msg = hidden
      ? "이 공개 플레이리스트를 공개 목록에서 숨길까요?"
      : "이 플레이리스트를 다시 공개 목록에 표시할까요?";
    if (!window.confirm(msg)) {
      return;
    }
    void runAction(async () => {
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
      }
    });
  };

  const handleResolve = (reportId: string) => {
    const note = (resolveNotes[reportId] ?? "").trim();
    void runAction(async () => {
      try {
        await resolvePlaylistReport(reportId, {
          resolutionNote: note || undefined,
        });
        setNotice("신고를 처리 완료로 표시했습니다.");
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
      }
    });
  };

  if (accessDenied) {
    return (
      <p className="playlist-admin-warning muted" role="status">
        운영자 권한이 필요합니다.
      </p>
    );
  }

  return (
    <div className="playlist-reports-panel">
      <div className="playlist-admin-toolbar">
        <input
          type="search"
          className="search-input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="제목·신고 내용·작성자 검색"
          maxLength={100}
          disabled={listLoading || busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const q = searchInput.trim();
              setQuery(q);
              void fetchList({ reset: true, q });
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={listLoading || busy}
          onClick={() => {
            const q = searchInput.trim();
            setQuery(q);
            void fetchList({ reset: true, q });
          }}
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

      <div className="playlist-admin-filter" role="group" aria-label="신고 상태">
        {(
          [
            ["open", "미처리"],
            ["resolved", "처리 완료"],
            ["all", "전체"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`playlist-tab playlist-tab--compact${statusFilter === value ? " playlist-tab--active" : ""}`}
            disabled={listLoading || busy}
            onClick={() => {
              setStatusFilter(value);
              void fetchList({ reset: true, status: value });
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {listLoading && items.length === 0 ? (
        <p className="muted">신고 목록을 불러오는 중…</p>
      ) : null}

      {items.length === 0 && loaded && !listLoading ? (
        <p className="playlist-empty muted">표시할 신고가 없습니다.</p>
      ) : null}

      <ul className="playlist-list playlist-reports-list">
        {items.map((item) => (
          <li key={item.id}>
            <article className="playlist-admin-card playlist-report-card">
              <div className="playlist-admin-card-head">
                <p className="playlist-card-title">{item.playlist.title}</p>
                <span
                  className={`playlist-admin-badge${item.status === "resolved" ? " playlist-admin-badge--visible" : ""}`}
                >
                  {item.status === "open" ? "미처리" : "처리 완료"}
                </span>
              </div>
              <p className="playlist-card-meta muted">
                작성자 {item.playlist.ownerNameSnapshot}
                {" · "}
                신고자 {item.reporterNameSnapshot}
                {" · "}
                {formatTime(item.createdAt)}
              </p>
              <p className="playlist-report-reason">
                {playlistReportReasonLabel(item.reason)}
              </p>
              {item.detail ? (
                <p className="playlist-card-desc muted">{item.detail}</p>
              ) : null}
              {item.playlist.isHiddenByAdmin ? (
                <p className="playlist-report-hidden-tag muted">운영자 숨김</p>
              ) : null}
              {item.status === "open" ? (
                <label className="playlist-form-field playlist-resolve-note">
                  <span className="muted">처리 메모 (선택)</span>
                  <input
                    type="text"
                    className="search-input"
                    value={resolveNotes[item.id] ?? ""}
                    maxLength={300}
                    disabled={busy || listLoading}
                    onChange={(e) =>
                      setResolveNotes((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                </label>
              ) : (
                <p className="muted playlist-resolve-done">
                  처리: {formatTime(item.resolvedAt)}
                  {item.resolutionNote
                    ? ` · ${item.resolutionNote}`
                    : ""}
                </p>
              )}
              <div className="playlist-admin-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy || listLoading}
                  onClick={() => onSelectPlaylist(item.playlist.id)}
                >
                  상세 보기
                </button>
                {item.status === "open" ? (
                  <>
                    {item.playlist.isHiddenByAdmin ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy || listLoading}
                        onClick={() =>
                          handleHide(item.playlist.id, false)
                        }
                      >
                        숨김 해제
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy || listLoading}
                        onClick={() => handleHide(item.playlist.id, true)}
                      >
                        숨김 처리
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy || listLoading}
                      onClick={() => handleResolve(item.id)}
                    >
                      처리 완료
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button
          type="button"
          className="btn btn-secondary playlist-load-more"
          disabled={listLoading || busy}
          onClick={() =>
            void fetchList({ reset: false, offset: items.length })
          }
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
    </div>
  );
}
