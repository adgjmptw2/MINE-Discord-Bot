import type { PlaylistSortOption } from "../utils/playlistSort";
import { PLAYLIST_SORT_LABELS } from "../utils/playlistSort";

type PlaylistListToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  sort: PlaylistSortOption;
  onSortChange: (sort: PlaylistSortOption) => void;
  sortOptions: PlaylistSortOption[];
  placeholder?: string;
  onSearchSubmit?: () => void;
  showSearchButton?: boolean;
  showClearButton?: boolean;
  onClear?: () => void;
  onRefresh?: () => void;
  searchDisabled?: boolean;
  refreshDisabled?: boolean;
  totalCount?: number;
  visibleCount?: number;
  isLoading?: boolean;
};

export function PlaylistListToolbar({
  searchValue,
  onSearchChange,
  sort,
  onSortChange,
  sortOptions,
  placeholder = "제목·설명 검색",
  onSearchSubmit,
  showSearchButton = false,
  showClearButton = false,
  onClear,
  onRefresh,
  searchDisabled = false,
  refreshDisabled = false,
  totalCount,
  visibleCount,
  isLoading = false,
}: PlaylistListToolbarProps) {
  const showCounts =
    typeof totalCount === "number" && typeof visibleCount === "number";

  return (
    <div className="playlist-list-toolbar">
      <div className="playlist-list-toolbar-search">
        <input
          type="search"
          className="search-input"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          maxLength={100}
          disabled={searchDisabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSearchSubmit) {
              onSearchSubmit();
            }
          }}
        />
        {showSearchButton ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={searchDisabled}
            onClick={onSearchSubmit}
          >
            검색
          </button>
        ) : null}
        {showClearButton ? (
          <button
            type="button"
            className="btn btn-secondary playlist-search-clear"
            disabled={searchDisabled}
            onClick={onClear}
          >
            초기화
          </button>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={refreshDisabled}
            onClick={onRefresh}
          >
            새로고침
          </button>
        ) : null}
      </div>
      <div className="playlist-list-toolbar-row">
        <label className="playlist-list-toolbar-sort muted">
          정렬
          <select
            className="playlist-sort-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as PlaylistSortOption)}
            disabled={searchDisabled}
          >
            {sortOptions.map((opt) => (
              <option key={opt} value={opt}>
                {PLAYLIST_SORT_LABELS[opt]}
              </option>
            ))}
          </select>
        </label>
        {showCounts ? (
          <p className="playlist-list-toolbar-count muted" aria-live="polite">
            {isLoading
              ? "목록 불러오는 중…"
              : `표시 ${visibleCount}개${totalCount !== visibleCount ? ` · 전체 ${totalCount}개` : ""}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
