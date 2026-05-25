import { useEffect, useRef, useState } from "react";
import { addSoundroomTrack, searchSoundroomTracks } from "../api";
import {
  isControlUnauthorized,
  mapSearchAddError,
} from "../controlErrors";
import { formatTrackDurationLabel } from "../format";
import type {
  SoundroomAddRequestDto,
  SoundroomGuildStateDto,
  SoundroomSearchResultDto,
} from "../types";

const NOTICE_MS = 4000;

type SoundroomSearchPanelProps = {
  guildId: string;
  disabled?: boolean;
  disabledReason?: string | null;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onAdded?: () => void;
  onUnauthorized?: () => void;
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
  disabled = false,
  disabledReason = null,
  onStateChange,
  onAdded,
  onUnauthorized,
}: SoundroomSearchPanelProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SoundroomSearchResultDto[]>([]);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const guildIdRef = useRef(guildId);
  const noticeTimer = useRef<number | null>(null);

  const busy = searchLoading || addLoading;
  const controlsDisabled = disabled || busy;

  useEffect(() => {
    guildIdRef.current = guildId;
    setInput("");
    setResults([]);
    setLastQuery(null);
    setError(null);
    setSuccess(null);
  }, [guildId]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current != null) {
        window.clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  const showSuccess = (message: string) => {
    setSuccess(message);
    if (noticeTimer.current != null) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(() => {
      setSuccess(null);
      noticeTimer.current = null;
    }, NOTICE_MS);
  };

  const runAdd = async (request: SoundroomAddRequestDto, label: string) => {
    if (controlsDisabled) {
      return;
    }
    const gid = guildIdRef.current;
    setAddLoading(true);
    setError(null);
    try {
      const res = await addSoundroomTrack(gid, request);
      if (guildIdRef.current !== gid) {
        return;
      }
      onStateChange(res.state);
      showSuccess(`「${label}」을(를) 대기열에 추가했습니다.`);
      onAdded?.();
    } catch (err) {
      if (guildIdRef.current !== gid) {
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
    setSuccess(null);
    try {
      const res = await searchSoundroomTracks(gid, query);
      if (guildIdRef.current !== gid) {
        return;
      }
      setLastQuery(res.query);
      setResults(res.results);
      if (res.results.length === 0) {
        setError("검색 결과가 없습니다.");
      }
    } catch (err) {
      if (guildIdRef.current !== gid) {
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

  const handleAddDirect = () => {
    const value = trimInput(input);
    if (!value) {
      setError("검색어를 입력해 주세요.");
      return;
    }
    void runAdd(buildAddRequestFromInput(value), value);
  };

  const handleAddResult = (result: SoundroomSearchResultDto) => {
    const label = result.title || lastQuery || "곡";
    void runAdd(
      buildAddRequestFromResult(result, lastQuery ?? trimInput(input)),
      label,
    );
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSearch();
  };

  return (
    <section className="search-section" aria-labelledby="search-heading">
      <h3 id="search-heading">노래 추가</h3>
      <p className="search-hint muted">
        검색어, YouTube URL, Spotify 단일 곡 URL을 입력할 수 있습니다.
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

      {searchLoading || addLoading ? (
        <p className="search-busy muted" role="status">
          {searchLoading ? "검색 중…" : "대기열에 추가하는 중…"}
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
