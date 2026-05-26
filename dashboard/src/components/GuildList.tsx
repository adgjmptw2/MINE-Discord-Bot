import { useState } from "react";
import { guildInitial } from "../format";
import type { WebDashboardGuildDto } from "../types";

type GuildListProps = {
  guilds: WebDashboardGuildDto[];
  selectedId: string | null;
  onSelect: (guildId: string) => void;
};

export function GuildList({ guilds, selectedId, onSelect }: GuildListProps) {
  const [brokenIcons, setBrokenIcons] = useState<Record<string, true>>({});

  if (guilds.length === 0) {
    return (
      <div className="guild-list-empty">
        <p>표시할 서버가 없습니다.</p>
        <p className="muted">봇과 함께 들어가 있는 서버만 목록에 나타납니다.</p>
      </div>
    );
  }

  return (
    <ul className="guild-list" role="listbox" aria-label="서버 목록">
      {guilds.map((g) => {
        const selected = g.id === selectedId;
        const showIcon = Boolean(g.iconUrl) && !brokenIcons[g.id];

        return (
          <li key={g.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`guild-item${selected ? " guild-item--selected" : ""}`}
              onClick={() => onSelect(g.id)}
            >
              {showIcon ? (
                <img
                  className="guild-icon"
                  src={g.iconUrl!}
                  alt=""
                  width={40}
                  height={40}
                  onError={() => {
                    setBrokenIcons((prev) => ({ ...prev, [g.id]: true }));
                  }}
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
                    {g.soundroomConfigured ? "설정됨" : "미설정"}
                  </span>
                  {g.hasAdministrator || g.hasManageGuild ? (
                    <span className="badge badge-info">관리</span>
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
