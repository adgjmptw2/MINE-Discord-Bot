import type {
  WebPlaylistFavoriteSummaryDto,
  WebPlaylistPublicSummaryDto,
  WebPlaylistSummaryDto,
} from "../types";

export type PlaylistSortOption =
  | "updatedDesc"
  | "createdDesc"
  | "titleAsc"
  | "trackCountDesc"
  | "favoritedDesc";

export const PLAYLIST_SORT_LABELS: Record<PlaylistSortOption, string> = {
  updatedDesc: "최근 수정순",
  createdDesc: "최근 생성순",
  titleAsc: "제목순",
  trackCountDesc: "곡 많은 순",
  favoritedDesc: "즐겨찾기한 순서순",
};

export const MINE_SORT_OPTIONS: PlaylistSortOption[] = [
  "updatedDesc",
  "createdDesc",
  "titleAsc",
  "trackCountDesc",
];

export const PUBLIC_SORT_OPTIONS: PlaylistSortOption[] = [
  "updatedDesc",
  "createdDesc",
  "titleAsc",
  "trackCountDesc",
];

export const FAVORITES_SORT_OPTIONS: PlaylistSortOption[] = [
  "favoritedDesc",
  "updatedDesc",
  "titleAsc",
  "trackCountDesc",
];

type SortableRow = {
  title: string;
  trackCount: number;
  createdAt?: string;
  updatedAt?: string;
  favoritedAt?: string;
};

function compareIsoDesc(a?: string, b?: string): number {
  const ta = a && !Number.isNaN(Date.parse(a)) ? Date.parse(a) : 0;
  const tb = b && !Number.isNaN(Date.parse(b)) ? Date.parse(b) : 0;
  return tb - ta;
}

export function sortPlaylistRows<T extends SortableRow>(
  items: T[],
  sort: PlaylistSortOption,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (sort) {
      case "updatedDesc":
        return (
          compareIsoDesc(a.updatedAt, b.updatedAt) ||
          compareIsoDesc(a.createdAt, b.createdAt)
        );
      case "createdDesc":
        return compareIsoDesc(a.createdAt, b.createdAt);
      case "titleAsc":
        return a.title.localeCompare(b.title, "ko");
      case "trackCountDesc":
        return b.trackCount - a.trackCount || a.title.localeCompare(b.title, "ko");
      case "favoritedDesc":
        return (
          compareIsoDesc(a.favoritedAt, b.favoritedAt) ||
          compareIsoDesc(a.updatedAt, b.updatedAt)
        );
      default:
        return 0;
    }
  });
  return copy;
}

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

export function filterMinePlaylists(
  items: WebPlaylistSummaryDto[],
  query: string,
): WebPlaylistSummaryDto[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return items;
  }
  return items.filter((item) => {
    const visLabel = item.visibility === "public" ? "공개" : "비공개";
    return (
      matchesQuery(item.title, q) ||
      matchesQuery(item.description, q) ||
      matchesQuery(visLabel, q)
    );
  });
}

export function filterFavoritePlaylists(
  items: WebPlaylistFavoriteSummaryDto[],
  query: string,
): WebPlaylistFavoriteSummaryDto[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return items;
  }
  return items.filter(
    (item) =>
      matchesQuery(item.title, q) ||
      matchesQuery(item.description, q) ||
      matchesQuery(item.ownerNameSnapshot, q),
  );
}

export function formatPlaylistDate(iso: string | undefined): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type PlaylistListEmptyKind =
  | "mine-empty"
  | "mine-search"
  | "public-empty"
  | "public-search"
  | "favorites-empty"
  | "favorites-search";

export function getPlaylistEmptyMessage(kind: PlaylistListEmptyKind): string {
  switch (kind) {
    case "mine-empty":
      return "아직 만든 플레이리스트가 없습니다.";
    case "mine-search":
      return "검색어와 일치하는 내 플레이리스트가 없습니다.";
    case "public-empty":
      return "공개 플레이리스트가 없습니다.";
    case "public-search":
      return "검색어와 일치하는 공개 플레이리스트가 없습니다.";
    case "favorites-empty":
      return "아직 즐겨찾기한 공개 플레이리스트가 없습니다.";
    case "favorites-search":
      return "검색어와 일치하는 즐겨찾기 플레이리스트가 없습니다.";
    default:
      return "목록이 비어 있습니다.";
  }
}
