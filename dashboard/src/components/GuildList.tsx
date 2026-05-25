import { guildInitial } from "../format";
import type { WebDashboardGuildDto } from "../types";

type GuildListProps = {
  guilds: WebDashboardGuildDto[];
  selectedId: string | null;
  onSelect: (guildId: string) => void;
};

export function GuildList({ guilds, selectedId, onSelect }: GuildListProps) {
  if (guilds.length === 0) {
    return (
      <div className="guild-list-empty">
        <p>표시할 서버가 없습니다.</p>
        <p className="muted">봇과 함께 들어가 있는 서버만 목록에 나타납니다.</p>
      </div>
    );
  }

  return (
    <ul className="guild-list">
      {guilds.map((g) => {
        const selected = g.id === selectedId;
        return (
          <li key={g.id}>
            <button
              type="button"
              className={`guild-item${selected ? " guild-item--selected" : ""}`}
              onClick={() => onSelect(g.id)}
            >
              {g.iconUrl ? (
                <img
                  className="guild-icon"
                  src={g.iconUrl}
                  alt=""
                  width={40}
                  height={40}
                />
              ) : (
                <span className="guild-icon guild-icon--fallback" aria-hidden>
                  {guildInitial(g.name)}
                </span>
              )}
              <span className="guild-meta">
                <span className="guild-name">{g.name}</span>
                <span className="guild-badges">
                  <span
                    className={
                      g.soundroomConfigured
                        ? "badge badge-ok"
                        : "badge badge-muted"
                    }
                  >
                    {g.soundroomConfigured ? "Soundroom 설정됨" : "Soundroom 미설정"}
                  </span>
                  {g.hasAdministrator || g.hasManageGuild ? (
                    <span className="badge badge-info">관리 가능</span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
