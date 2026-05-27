import type { ReactNode } from "react";

export type SoundroomWorkspaceTab = "add" | "playlist" | "queue";

type SoundroomWorkspaceTabsProps = {
  activeTab: SoundroomWorkspaceTab;
  onTabChange: (tab: SoundroomWorkspaceTab) => void;
  queueCount: number;
  addPanel: ReactNode;
  playlistPanel: ReactNode;
  queuePanel: ReactNode;
};

const TABS: { id: SoundroomWorkspaceTab; label: string }[] = [
  { id: "add", label: "노래 추가" },
  { id: "playlist", label: "플레이리스트" },
  { id: "queue", label: "대기열" },
];

export function SoundroomWorkspaceTabs({
  activeTab,
  onTabChange,
  queueCount,
  addPanel,
  playlistPanel,
  queuePanel,
}: SoundroomWorkspaceTabsProps) {
  const queueLabel =
    queueCount > 0 ? `대기열 (${queueCount})` : "대기열";

  return (
    <div className="soundroom-workspace">
      <div className="soundroom-workspace-tabs" role="tablist" aria-label="작업 탭">
        {TABS.map((tab) => {
          const label = tab.id === "queue" ? queueLabel : tab.label;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`soundroom-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`soundroom-panel-${tab.id}`}
              className={`soundroom-workspace-tab${selected ? " soundroom-workspace-tab--active" : ""}${tab.id === "playlist" ? " soundroom-workspace-tab--playlist" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        id="soundroom-panel-add"
        role="tabpanel"
        aria-labelledby="soundroom-tab-add"
        hidden={activeTab !== "add"}
        className="soundroom-workspace-panel"
      >
        {addPanel}
      </div>
      <div
        id="soundroom-panel-playlist"
        role="tabpanel"
        aria-labelledby="soundroom-tab-playlist"
        hidden={activeTab !== "playlist"}
        className="soundroom-workspace-panel"
      >
        {playlistPanel}
      </div>
      <div
        id="soundroom-panel-queue"
        role="tabpanel"
        aria-labelledby="soundroom-tab-queue"
        hidden={activeTab !== "queue"}
        className="soundroom-workspace-panel"
      >
        {queuePanel}
      </div>
    </div>
  );
}
