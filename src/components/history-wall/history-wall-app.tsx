"use client";

import { useMemo, useState } from "react";

import type { HistoryWallData, HistoryWallRecord } from "@/contracts/history-wall.types";
import { updateRecord } from "@/lib/history-wall/data-client";
import { buildWallLayout } from "@/lib/history-wall/layout";
import { clampZoom } from "@/lib/history-wall/time-scale";
import TimelineHeader from "./timeline-header";
import TimelineWall from "./timeline-wall";
import NoteDock from "./note-dock";

function allRecords(data: HistoryWallData): HistoryWallRecord[] {
  return [...data.civilizations, ...data.people, ...data.events, ...data.eras];
}

function replaceRecord(data: HistoryWallData, updated: HistoryWallRecord): HistoryWallData {
  const swap = <T extends HistoryWallRecord>(list: T[]) =>
    list.map((r) => (r.id === updated.id ? (updated as T) : r));
  return {
    ...data,
    civilizations: swap(data.civilizations),
    people: swap(data.people),
    events: swap(data.events),
    eras: swap(data.eras),
  };
}

// TODO(ai-strip): replace with a real call once the suggestion endpoint lands.
function suggestFromNotes(record: HistoryWallRecord | null): string | null {
  if (!record) return null;
  const source = record.details?.markdown?.trim() ? record.details.markdown : record.notes;
  const firstLine = source.split("\n").find((l) => l.trim()) ?? "";
  const hook = firstLine.replace(/[#*>_`]/g, "").trim().slice(0, 80);
  return hook
    ? `Based on your notes — want to dig into "${hook}${hook.length >= 80 ? "…" : ""}"?`
    : `Add a note on ${record.title} and I'll suggest a rabbit hole to explore.`;
}

export default function HistoryWallApp({ initialData }: { initialData: HistoryWallData }) {
  const [data, setData] = useState(initialData);
  const [zoom, setZoom] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bands = useMemo(() => buildWallLayout(data), [data]);
  const activeRecord = useMemo(
    () => allRecords(data).find((r) => r.id === activeId) ?? null,
    [data, activeId],
  );
  const suggestion = useMemo(() => suggestFromNotes(activeRecord), [activeRecord]);
  const civilizationTitles = useMemo(
    () => new Map(data.civilizations.map((c) => [c.id, c.title])),
    [data.civilizations],
  );

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
      <TimelineHeader />
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
      <NoteDock
        record={activeRecord}
        saving={saving}
        suggestion={suggestion}
        civilizationTitles={civilizationTitles}
        onClose={() => setActiveId(null)}
        onSave={handleSave}
        onSelect={setActiveId}
        onExplore={() => {
          // TODO(ai-strip): navigate to / create the suggested topic.
          console.log("Explore suggestion for", activeRecord?.id);
        }}
      />
    </div>
  );
}
