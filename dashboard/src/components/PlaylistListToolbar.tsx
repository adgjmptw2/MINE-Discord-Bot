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
  searchDisabled?: boolean;
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
  searchDisabled = false,
}: PlaylistListToolbarProps) {
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
        {showClearButton && searchValue.trim() ? (
          <button
            type="button"
            className="btn btn-secondary playlist-search-clear"
            disabled={searchDisabled}
            onClick={onClear}
          >
            초기화
          </button>
        ) : null}
      </div>
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
    </div>
  );
}
