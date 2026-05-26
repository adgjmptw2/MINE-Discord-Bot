import { useId, useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string | null;
  defaultOpen?: boolean;
  rightAddon?: ReactNode;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  subtitle = null,
  defaultOpen = true,
  rightAddon = null,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="dash-section">
      <button
        type="button"
        className="dash-section-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dash-section-toggle-text">
          <span className="dash-section-title">{title}</span>
          {subtitle ? (
            <span className="dash-section-subtitle muted">{subtitle}</span>
          ) : null}
        </span>
        {rightAddon ? (
          <span className="dash-section-addon">{rightAddon}</span>
        ) : null}
        <span className="dash-section-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="dash-section-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}
