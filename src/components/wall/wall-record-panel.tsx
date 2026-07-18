"use client";

import type { HistoryWallRecord } from "@/contracts/history-wall.types";

export default function WallRecordPanel({
  onClose,
  record,
}: {
  onClose: () => void;
  record: HistoryWallRecord;
}) {
  const note = record.details?.markdown || record.notes || "No notes yet.";

  return (
    <aside
      aria-label={`${record.title} details`}
      style={{
        background: "rgba(251,248,240,.97)",
        border: "1px solid var(--line-4)",
        borderRadius: 16,
        bottom: 76,
        boxShadow: "0 16px 48px rgba(43,38,32,.22)",
        maxHeight: "min(70vh, 620px)",
        overflow: "auto",
        padding: 24,
        position: "absolute",
        right: 18,
        width: "min(390px, calc(100vw - 36px))",
        zIndex: 40,
      }}
    >
      <button
        aria-label="Close details"
        onClick={onClose}
        style={{
          alignItems: "center",
          background: "var(--app-bg)",
          border: "1px solid var(--line)",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          height: 32,
          justifyContent: "center",
          position: "absolute",
          right: 16,
          top: 16,
          width: 32,
        }}
        type="button"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          close
        </span>
      </button>
      <div
        className="font-mono"
        style={{
          color: "var(--accent-deep)",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: ".2em",
          textTransform: "uppercase",
        }}
      >
        {record.type} · local detail
      </div>
      <h2
        className="font-serif"
        style={{ fontSize: 28, lineHeight: 1.1, margin: "8px 42px 5px 0" }}
      >
        {record.title}
      </h2>
      <div className="font-mono" style={{ color: "var(--muted)", fontSize: 11 }}>
        {record.span.displayLabel}
      </div>
      <div
        className="note-markdown"
        style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 18 }}
      >
        <p style={{ whiteSpace: "pre-wrap" }}>{note}</p>
      </div>
      {record.details?.tags.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {record.details.tags.map((tag) => (
            <span
              className="font-mono"
              key={tag}
              style={{
                background: "#f3ead6",
                borderRadius: 999,
                color: "#8a6d3b",
                fontSize: 9,
                padding: "5px 8px",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
