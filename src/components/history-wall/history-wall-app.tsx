"use client";

import { useMemo, useState } from "react";

import type { HistoryWallData, HistoryWallRecord } from "@/contracts/history-wall.types";
import { updateRecord } from "@/lib/history-wall/data-client";
import { buildWallLayout } from "@/lib/history-wall/layout";
import { clampZoom } from "@/lib/history-wall/time-scale";
import TimelineHeader from "./timeline-header";
import TimelineWall from "./timeline-wall";
import HistoryMap from "./history-map";
import NoteDock from "./note-dock";

export type WallView = "timeline" | "map";

function allRecords(data: HistoryWallData): HistoryWallRecord[] {
  return [...data.civilizations, ...data.events, ...data.eras];
}

function replaceRecord(data: HistoryWallData, updated: HistoryWallRecord): HistoryWallData {
  const swap = <T extends HistoryWallRecord>(list: T[]) =>
    list.map((r) => (r.id === updated.id ? (updated as T) : r));
  return {
    ...data,
    civilizations: swap(data.civilizations),
    events: swap(data.events),
    eras: swap(data.eras),
  };
}

// TODO(ai-strip): replace with a real (Pikachu-flavored!) call once the endpoint lands.
function suggestFromNotes(record: HistoryWallRecord | null): string | null {
  if (!record) return null;
  const source = record.details?.markdown?.trim() ? record.details.markdown : record.notes;
  const firstLine = source.split("\n").find((l) => l.trim()) ?? "";
  const hook = firstLine.replace(/[#*>_`]/g, "").trim().slice(0, 70);
  if (!hook) {
    return `Pika? ⚡ Jot a note on ${record.title} and I'll spark a rabbit-hole for you — pika-pika!`;
  }
  const lines = [
    `Pika-pika! ⚡ Your notes on ${record.title} zapped an idea — wanna chase "${hook}"?`,
    `Pikaaa! ⚡ Based on this, have you heard about "${hook}"? Let's bolt over there!`,
    `Pika! Something's sparking here — dig into "${hook}" and I'll follow, pika-pika!`,
    `⚡ Pi-ka-chu picks: "${hook}" looks electric. Shall we explore?`,
  ];
  return lines[hook.length % lines.length]; // deterministic so it doesn't flicker
}

export default function HistoryWallApp({ initialData }: { initialData: HistoryWallData }) {
  const [data, setData] = useState(initialData);
  const [zoom, setZoom] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<WallView>("timeline");

  const bands = useMemo(() => buildWallLayout(data), [data]);
  const activeRecord = useMemo(
    () => allRecords(data).find((r) => r.id === activeId) ?? null,
    [data, activeId],
  );
  const suggestion = useMemo(() => suggestFromNotes(activeRecord), [activeRecord]);

  const handleSave = async (updated: HistoryWallRecord) => {
    setData((prev) => replaceRecord(prev, updated)); // optimistic
    setSaving(true);
    try {
      await updateRecord(updated);
    } catch {
      // Keep the optimistic edit; a real error toast can go here later.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <TimelineHeader view={view} onViewChange={setView} />
      {view === "timeline" ? (
        <TimelineWall
          bands={bands}
          zoom={zoom}
          activeId={activeId}
          activeYear={activeRecord ? activeRecord.span.startYear : null}
          onSelect={setActiveId}
          onZoomIn={() => setZoom((z) => clampZoom(z * 1.25))}
          onZoomOut={() => setZoom((z) => clampZoom(z / 1.25))}
          onZoomFit={() => setZoom(1)}
        />
      ) : (
        <HistoryMap data={data} activeId={activeId} onSelect={setActiveId} />
      )}
      <NoteDock
        record={activeRecord}
        saving={saving}
        suggestion={suggestion}
        onClose={() => setActiveId(null)}
        onSave={handleSave}
        onExplore={() => {
          // TODO(ai-strip): navigate to / create the suggested topic.
          console.log("Explore suggestion for", activeRecord?.id);
        }}
      />
    </div>
  );
}
