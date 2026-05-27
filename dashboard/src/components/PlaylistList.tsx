import type {
  WebPlaylistFavoriteSummaryDto,
  WebPlaylistPublicSummaryDto,
  WebPlaylistSummaryDto,
} from "../types";
import {
  formatPlaylistDate,
  getPlaylistEmptyMessage,
  type PlaylistListEmptyKind,
} from "../utils/playlistSort";

type BaseListProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyKind: PlaylistListEmptyKind;
  queueAddDisabled?: boolean;
  onAddToQueue?: (playlistId: string) => void;
  queueBusyId?: string | null;
  favoriteBusyId?: string | null;
};

type MineListProps = BaseListProps & {
  variant: "mine";
  items: WebPlaylistSummaryDto[];
};

type PublicListProps = BaseListProps & {
  variant: "public";
  items: WebPlaylistPublicSummaryDto[];
  onFavoriteToggle?: (id: string, isFavorited: boolean) => void;
};

type FavoritesListProps = BaseListProps & {
  variant: "favorites";
  items: WebPlaylistFavoriteSummaryDto[];
  onFavoriteToggle?: (id: string, isFavorited: boolean) => void;
};

export type PlaylistListProps = MineListProps | PublicListProps | FavoritesListProps;

function VisibilityBadge({
  visibility,
  hidden,
}: {
  visibility: "public" | "private" | null;
  hidden?: boolean;
}) {
  if (!visibility) {
    return null;
  }
  return (
    <span
      className={`playlist-badge playlist-badge--${visibility}${hidden ? " playlist-badge--hidden" : ""}`}
    >
      {visibility === "public" ? "공개" : "비공개"}
      {hidden ? " · 숨김" : ""}
    </span>
  );
}

export function PlaylistList(props: PlaylistListProps) {
  const { items, selectedId, onSelect, emptyKind } = props;

  if (items.length === 0) {
    return (
      <p className="playlist-empty muted">{getPlaylistEmptyMessage(emptyKind)}</p>
    );
  }

  const showQueueAdd =
    (props.variant === "public" || props.variant === "favorites") &&
    Boolean(props.onAddToQueue);

  return (
    <ul className="playlist-list">
      {items.map((item) => {
        const selected = item.id === selectedId;
        const queueBusy = props.queueBusyId === item.id;
        const favoriteBusy = props.favoriteBusyId === item.id;
        const canQueue =
          showQueueAdd &&
          !props.queueAddDisabled &&
          item.trackCount > 0 &&
          Boolean(props.onAddToQueue);

        if (props.variant === "mine") {
          const mine = item as WebPlaylistSummaryDto;
          return (
            <li key={item.id}>
              <div
                className={`playlist-card${selected ? " playlist-card--selected" : ""}`}
              >
                <button
                  type="button"
                  className="playlist-card-main"
                  onClick={() => onSelect(item.id)}
                >
                  <div className="playlist-card-head">
                    <p className="playlist-card-title">{mine.title}</p>
                    <VisibilityBadge
                      visibility={mine.visibility}
                      hidden={mine.isHiddenByAdmin}
                    />
                  </div>
                  {mine.description ? (
                    <p className="playlist-card-desc muted">{mine.description}</p>
                  ) : null}
                  <p className="playlist-card-meta muted">
                    <span>{mine.trackCount}곡</span>
                    {formatPlaylistDate(mine.updatedAt) ? (
                      <span> · 수정 {formatPlaylistDate(mine.updatedAt)}</span>
                    ) : null}
                  </p>
                </button>
              </div>
            </li>
          );
        }

        const isPublic = props.variant === "public";
        const pub = item as WebPlaylistPublicSummaryDto;
        const fav = props.variant === "favorites"
          ? (item as WebPlaylistFavoriteSummaryDto)
          : null;
        const isFavorited = isPublic ? !!pub.isFavorited : true;
        const ownerName = isPublic ? pub.ownerNameSnapshot : fav!.ownerNameSnapshot;
        const favoritedAt = fav?.favoritedAt;

        return (
          <li key={item.id}>
            <div
              className={`playlist-card${selected ? " playlist-card--selected" : ""}`}
            >
              <button
                type="button"
                className="playlist-card-main"
                onClick={() => onSelect(item.id)}
              >
                <div className="playlist-card-head">
                  <p className="playlist-card-title">{item.title}</p>
                  <span className="playlist-badge playlist-badge--public">
                    공개
                  </span>
                  {isFavorited ? (
                    <span className="playlist-favorite-badge" aria-hidden>
                      ★
                    </span>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="playlist-card-desc muted">{item.description}</p>
                ) : null}
                <p className="playlist-card-meta muted">
                  <span>{item.trackCount}곡</span>
                  <span> · {ownerName}</span>
                  {formatPlaylistDate(item.updatedAt) ? (
                    <span> · 수정 {formatPlaylistDate(item.updatedAt)}</span>
                  ) : null}
                  {favoritedAt && formatPlaylistDate(favoritedAt) ? (
                    <span className="playlist-card-favorited-at">
                      {" "}
                      · 즐겨찾기 {formatPlaylistDate(favoritedAt)}
                    </span>
                  ) : null}
                </p>
              </button>
              <div className="playlist-card-actions">
                {showQueueAdd ? (
                  <button
                    type="button"
                    className="btn btn-primary playlist-card-queue-btn"
                    disabled={!canQueue || queueBusy || favoriteBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onAddToQueue?.(item.id);
                    }}
                  >
                    {queueBusy ? "추가 중…" : "대기열에 추가"}
                  </button>
                ) : null}
                {props.variant === "favorites" && props.onFavoriteToggle ? (
                  <button
                    type="button"
                    className="playlist-favorite-button active"
                    disabled={favoriteBusy || queueBusy}
                    aria-label="즐겨찾기 해제"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onFavoriteToggle!(item.id, true);
                    }}
                  >
                    ★ 해제
                  </button>
                ) : null}
                {isPublic && props.onFavoriteToggle ? (
                  <button
                    type="button"
                    className={`playlist-favorite-button${isFavorited ? " active" : ""}`}
                    disabled={favoriteBusy || queueBusy}
                    aria-pressed={isFavorited}
                    aria-label={isFavorited ? "즐겨찾기 해제" : "즐겨찾기"}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onFavoriteToggle!(item.id, isFavorited);
                    }}
                  >
                    {favoriteBusy
                      ? "처리 중…"
                      : isFavorited
                        ? "★ 해제"
                        : "☆ 즐겨찾기"}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
