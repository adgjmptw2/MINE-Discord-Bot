import type {
  WebPlaylistPublicSummaryDto,
  WebPlaylistSummaryDto,
} from "../types";

type MineListProps = {
  variant: "mine";
  items: WebPlaylistSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type PublicListProps = {
  variant: "public";
  items: WebPlaylistPublicSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type PlaylistListProps = MineListProps | PublicListProps;

export function PlaylistList(props: PlaylistListProps) {
  const { items, selectedId, onSelect } = props;

  if (items.length === 0) {
    return (
      <p className="playlist-empty muted">
        {props.variant === "mine"
          ? "플레이리스트가 없습니다. 새로 만들어 보세요."
          : "공개 플레이리스트가 없습니다."}
      </p>
    );
  }

  return (
    <ul className="playlist-list">
      {items.map((item) => {
        const selected = item.id === selectedId;
        const visibility =
          props.variant === "mine"
            ? (item as WebPlaylistSummaryDto).visibility
            : null;
        const ownerName =
          props.variant === "public"
            ? (item as WebPlaylistPublicSummaryDto).ownerNameSnapshot
            : null;
        const hidden =
          props.variant === "mine" &&
          (item as WebPlaylistSummaryDto).isHiddenByAdmin;

        return (
          <li key={item.id}>
            <button
              type="button"
              className={`playlist-card${selected ? " playlist-card--selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <p className="playlist-card-title">{item.title}</p>
              {item.description ? (
                <p className="playlist-card-desc muted">{item.description}</p>
              ) : null}
              <p className="playlist-card-meta muted">
                {item.trackCount}곡
                {visibility === "public" ? " · 공개" : visibility === "private" ? " · 비공개" : ""}
                {ownerName ? ` · ${ownerName}` : ""}
                {hidden ? " · 운영자 숨김" : ""}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
