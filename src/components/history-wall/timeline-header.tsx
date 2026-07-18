"use client";

import type { WallView } from "./history-wall-app";

export default function TimelineHeader({
  view,
  onViewChange,
}: {
  view: WallView;
  onViewChange: (view: WallView) => void;
}) {
  return (
    <header
      className="flex items-center justify-between"
      style={{
        height: 62,
        flex: "0 0 62px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)",
        padding: "0 22px",
      }}
    >
      {/* Logo lockup */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2px solid var(--accent)",
            background: "var(--app-bg)",
            boxShadow: "0 2px 6px rgba(232,169,12,.25)",
          }}
        >
          <span className="material-symbols-outlined filled" style={{ fontSize: 24, color: "var(--accent)" }}>
            bolt
          </span>
        </div>
        <div>
          <div className="font-serif flex items-center" style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
            Pika
            <span className="material-symbols-outlined filled" style={{ fontSize: 17, color: "var(--accent)" }}>
              bolt
            </span>
            History
          </div>
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--faint)", marginTop: -2 }}>
            STUDY TIMELINE
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Timeline ⇄ Map toggle */}
        <div
          className="flex items-center"
          style={{ background: "var(--app-bg)", border: "1px solid var(--line)", borderRadius: 999, padding: 2 }}
        >
          {(["timeline", "map"] as const).map((v) => {
            const on = view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                className="flex items-center gap-1"
                style={{
                  borderRadius: 999,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--text)" : "var(--muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {v === "timeline" ? "timeline" : "public"}
                </span>
                {v === "timeline" ? "Timeline" : "Map"}
              </button>
            );
          })}
        </div>
        <div
          className="flex items-center gap-2"
          style={{
            width: 230,
            height: 36,
            borderRadius: 999,
            background: "var(--app-bg)",
            border: "1px solid var(--line)",
            padding: "0 14px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--faint)" }}>
            search
          </span>
          <span style={{ fontSize: 13, color: "var(--faint)" }}>Search eras, people, places…</span>
        </div>
        <div
          className="flex items-center gap-1"
          style={{ height: 36, borderRadius: 999, background: "var(--app-bg)", border: "1px solid var(--line)", padding: "0 14px", fontSize: 13, color: "var(--muted)" }}
        >
          All continents
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            expand_more
          </span>
        </div>
        <div
          className="font-serif flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: "50%", background: "#e7ead9", border: "1px solid #d7d9c4", color: "#4d6b53", fontWeight: 600 }}
        >
          M
        </div>
      </div>
    </header>
  );
}
