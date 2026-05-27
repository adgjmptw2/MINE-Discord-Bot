import { useEffect, useRef, useState } from "react";
import {
  addSoundroomPlaylist,
  addSoundroomTrack,
  searchSoundroomTracks,
} from "../api";
import {
  isControlUnauthorized,
  mapSearchAddError,
} from "../controlErrors";
import { useTransientNotice } from "../hooks/useTransientNotice";
import { formatTrackDurationLabel } from "../format";
import { isStaleGuild } from "../utils/requestGuards";
import type {
  SoundroomAddRequestDto,
  SoundroomGuildStateDto,
  SoundroomSearchResultDto,
} from "../types";

type SoundroomSearchPanelProps = {
  guildId: string;
  /** CollapsibleSection 안에 넣을 때 중복 제목·구분선 제거 */
  embedded?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onAdded?: () => void;
  onUnauthorized?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
};

function trimInput(value: string): string {
  return value.trim();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function buildAddRequestFromInput(input: string): SoundroomAddRequestDto {
  const trimmed = trimInput(input);
  if (isHttpUrl(trimmed)) {
    return { uri: trimmed };
  }
  return { query: trimmed };
}

function buildAddRequestFromResult(
  result: SoundroomSearchResultDto,
  fallbackQuery: string,
): SoundroomAddRequestDto {
  if (result.uri) {
    return { uri: result.uri };
  }
  return { query: result.title || fallbackQuery };
}

export function SoundroomSearchPanel({
  guildId,
  embedded = false,
  disabled = false,
  disabledReason = null,
  onStateChange,
  onAdded,
  onUnauthorized,
  onUserActionStart,
  onUserActionEnd,
}: SoundroomSearchPanelProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SoundroomSearchResultDto[]>([]);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistLimit, setPlaylistLimit] = useState(50);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message: success, show: showSuccess } = useTransientNotice();
  const guildIdRef = useRef(guildId);
  const wasBusyRef = useRef(false);

  const busy = searchLoading || addLoading || playlistLoading;
  const controlsDisabled = disabled || busy;

  useEffect(() => {
    guildIdRef.current = guildId;
    setInput("");
    setResults([]);
    setLastQuery(null);
    setPlaylistUrl("");
    setPlaylistLimit(50);
    setError(null);
  }, [guildId]);

  useEffect(() => {
    if (busy && !wasBusyRef.current) {
      onUserActionStart?.();
    }
    if (!busy && wasBusyRef.current) {
      onUserActionEnd?.();
    }
    wasBusyRef.current = busy;
  }, [busy, onUserActionStart, onUserActionEnd]);

  const runAdd = async (
    request: SoundroomAddRequestDto,
    successMessage: string,
  ) => {
    if (controlsDisabled) {
      return;
    }
    const gid = guildIdRef.current;
    setAddLoading(true);
    setError(null);
    try {
      const res = await addSoundroomTrack(gid, request);
      if (isStaleGuild(gid, guildIdRef.current)) {
        return;
      }
      onStateChange(res.state);
      showSuccess(successMessage);
      onAdded?.();
    } catch (err) {
      if (isStaleGuild(gid, guildIdRef.current)) {
        return;
      }
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapSearchAddError(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handleSearch = async () => {
    const query = trimInput(input);
    if (!query) {
      setError("검색어를 입력해 주세요.");
      setResults([]);
      return;
    }
    if (controlsDisabled) {
      return;
    }

    const gid = guildIdRef.current;
    setSearchLoading(true);
    setError(null);
    try {
      const res = await searchSoundroomTracks(gid, query);
      if (isStaleGuild(gid, guildIdRef.current)) {
        return;
      }
      setLastQuery(res.query);
      setResults(res.results);
      if (res.results.length === 0) {
        setError("검색 결과가 없습니다.");
      }
    } catch (err) {
      if (isStaleGuild(gid, guildIdRef.current)) {
        return;
      }
      setResults([]);
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapSearchAddError(err));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddPlaylist = async () => {
    const uri = trimInput(playlistUrl);
    if (!uri) {
      setError("재생목록 URL을 입력해 주세요.");
      return;
    }
    if (controlsDisabled) {
      return;
    }
    const gid = guildIdRef.current;
    setPlaylistLoading(true);
    setError(null);
    try {
      const res = await addSoundroomPlaylist(gid, {
        uri,
        limit: playlistLimit,
      });
      if (isStaleGuild(gid, guildIdRef.current)) {
        return;
      }
      onStateChange(res.state);
      const base = `재생목록에서 ${res.addedCount}곡을 대기열에 추가했습니다.`;
      showSuccess(
        res.truncated ? `${base} 최대 ${res.limit}곡까지만 추가했습니다.` : base,
      );
      onAdded?.();
    } catch (err) {
      if (isStaleGuild(gid, guildIdRef.current)) {
        return;
      }
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapSearchAddError(err));
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handleAddDirect = () => {
    const value = trimInput(input);
    if (!value) {
      setError("검색어를 입력해 주세요.");
      return;
    }
    void runAdd(
      buildAddRequestFromInput(value),
      "대기열에 추가했습니다.",
    );
  };

  const handleAddResult = (result: SoundroomSearchResultDto) => {
    void runAdd(
      buildAddRequestFromResult(result, lastQuery ?? trimInput(input)),
      "검색 결과를 대기열에 추가했습니다.",
    );
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSearch();
  };

  const rootClass = embedded
    ? "search-section search-section--embedded"
    : "search-section";

  return (
    <section
      className={rootClass}
      aria-labelledby={embedded ? undefined : "search-heading"}
    >
      {embedded ? null : <h3 id="search-heading">노래 추가</h3>}
      <p className="search-hint muted">
        제목 검색, YouTube·Spotify 단일 곡 URL. 재생목록은 아래 전용 영역을
        사용해 주세요.
      </p>

      {disabledReason && disabled ? (
        <p className="search-disabled-hint" role="status">
          {disabledReason}
        </p>
      ) : disabledReason && !disabled ? (
        <p className="search-disabled-hint search-disabled-hint--info" role="status">
          {disabledReason}
        </p>
      ) : null}

      <form className="search-form" onSubmit={onSubmitSearch}>
        <div className="search-input-row">
          <input
            className="search-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="노래 제목 또는 YouTube/Spotify URL"
            disabled={controlsDisabled}
            maxLength={300}
            autoComplete="off"
          />
          <div className="search-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={controlsDisabled}
            >
              {searchLoading ? "검색 중…" : "검색"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={controlsDisabled}
              onClick={() => void handleAddDirect()}
            >
              {addLoading ? "추가 중…" : "바로 추가"}
            </button>
          </div>
        </div>
      </form>

      <div className="playlist-add-block">
        <h4 className="playlist-add-heading">URL 재생목록 추가</h4>
        <p className="search-hint muted playlist-add-hint">
          지원되는 재생목록 URL을 최대 50곡까지 대기열에 추가합니다.
        </p>
        <div className="playlist-add-row">
          <input
            className="search-input playlist-add-input"
            type="url"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="YouTube 재생목록 URL"
            disabled={controlsDisabled}
            maxLength={300}
            autoComplete="off"
          />
          <label className="playlist-limit-label muted">
            최대
            <select
              className="playlist-limit-select"
              value={playlistLimit}
              onChange={(e) =>
                setPlaylistLimit(Number.parseInt(e.target.value, 10))
              }
              disabled={controlsDisabled}
            >
              <option value={10}>10곡</option>
              <option value={25}>25곡</option>
              <option value={50}>50곡</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary playlist-add-btn"
            disabled={controlsDisabled}
            onClick={() => void handleAddPlaylist()}
          >
            {playlistLoading ? "추가 중…" : "재생목록 추가"}
          </button>
        </div>
      </div>

      {searchLoading || addLoading || playlistLoading ? (
        <p className="search-busy muted" role="status">
          {searchLoading
            ? "검색 중…"
            : playlistLoading
              ? "재생목록을 추가하는 중…"
              : "대기열에 추가하는 중…"}
        </p>
      ) : null}

      {error ? (
        <p className="search-error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="search-success" role="status">
          {success}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="search-results" aria-label="검색 결과">
          {results.map((result) => (
            <li key={result.id} className="search-result-item">
              {result.thumbnailUrl ? (
                <img
                  className="search-result-thumb"
                  src={result.thumbnailUrl}
                  alt=""
                  width={72}
                  height={72}
                />
              ) : (
                <div className="search-result-thumb search-result-thumb--empty" aria-hidden>
                  ♪
                </div>
              )}
              <div className="search-result-body">
                <p className="search-result-title">{result.title}</p>
                <p className="search-result-meta muted">
                  {result.author ?? "아티스트 알 수 없음"}
                  {" · "}
                  {formatTrackDurationLabel(result.durationMs, result.isStream)}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-add-result"
                  disabled={controlsDisabled}
                  onClick={() => handleAddResult(result)}
                >
                  대기열에 추가
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
