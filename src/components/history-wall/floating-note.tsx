"use client";

import type { HistoryWallRecord } from "@/contracts/history-wall.types";
import { DockContent } from "./note-dock";

interface FloatingNoteProps {
  record: HistoryWallRecord;
  index: number;
  saving: boolean;
  suggestion: string | null;
  startEditing?: boolean;
  onClose: () => void;
  onSave: (record: HistoryWallRecord) => void;
  onExplore: () => void;
}

/**
 * A note rendered as a floating popup card (design update: replaces the bottom
 * dock). Several can be open at once; each expands as its own card, cascaded so
 * they don't fully overlap, and closes with the ✕ inside DockContent.
 */
export default function FloatingNote({ index, ...content }: FloatingNoteProps) {
  const offset = index * 30;
  return (
    <div
      className="note-pop"
      style={{
        position: "fixed",
        right: 24 + offset,
        top: 84 + offset,
        width: "min(600px, 92vw)",
        height: "min(430px, 74vh)",
        zIndex: 40 + index,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 18px 50px rgba(43,38,32,.28)",
      }}
    >
      <DockContent {...content} />
    </div>
  );
}
