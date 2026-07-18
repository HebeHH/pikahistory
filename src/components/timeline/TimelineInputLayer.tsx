"use client";

export type TimelineInputMode =
  | "inspect"
  | "person"
  | "event"
  | "era"
  | "civilization";

type TimelineInputLayerProps = {
  domainStart: number;
  domainEnd: number;
  mode: TimelineInputMode;
  onModeChange: (mode: TimelineInputMode) => void;
  message: string;
};

export function yearAtPointer(
  clientX: number,
  element: HTMLElement,
  domainStart: number,
  domainEnd: number,
) {
  const bounds = element.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
  return Math.round(domainStart + ratio * (domainEnd - domainStart));
}

/**
 * Input behavior is deliberately separate from timeline rendering:
 * - event mode uses one tap/click for an instant;
 * - era/civilization modes use click-and-drag for a span.
 *
 * The parent can later turn the emitted draft into the canonical Zod payload.
 */
export function TimelineInputLayer({
  mode,
  onModeChange,
  message,
}: TimelineInputLayerProps) {
  return (
    <section className="input-panel" aria-label="Timeline input tools">
      <div className="input-tools" role="toolbar" aria-label="Add to timeline">
        {(
          [
            ["inspect", "Inspect"],
            ["person", "Person · tap"],
            ["event", "Event · tap"],
            ["era", "Era · drag"],
            ["civilization", "Civilization · drag"],
          ] as const
        ).map(([value, label]) => (
          <button
            className={mode === value ? "active" : ""}
            key={value}
            onClick={() => onModeChange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <p>{message}</p>
      <div className="input-hit-area">Choose a tool, then use a civilization row</div>
    </section>
  );
}
