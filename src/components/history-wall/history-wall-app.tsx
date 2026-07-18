"use client";

import { useMemo, useRef, useState } from "react";

import type { HistoryWallData, HistoryWallRecord } from "@/contracts/history-wall.types";
import { updateRecord } from "@/lib/history-wall/data-client";
import { buildWallLayout } from "@/lib/history-wall/layout";
import { funFactBetween } from "@/lib/history-wall/fun-facts";
import { clampZoom, formatYear } from "@/lib/history-wall/time-scale";
import TimelineHeader from "./timeline-header";
import TimelineWall from "./timeline-wall";
import HistoryMap from "./history-map";
import FloatingNote from "./floating-note";
import FunFactBurst from "./fun-fact-burst";

export type WallView = "timeline" | "map";

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
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<WallView>("timeline");
  const [funFact, setFunFact] = useState<{ aId: string; bId: string; fact: string } | null>(null);
  const lastCivRef = useRef<string | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);

  const bands = useMemo(() => buildWallLayout(data), [data]);
  const activeRecord = useMemo(
    () => allRecords(data).find((r) => r.id === activeId) ?? null,
    [data, activeId],
  );
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

  const openNote = (id: string) => {
    setOpenIds([id]); // one bubble at a time — opening a new note closes the others
    setActiveId(id);
  };

  const closeNote = (id: string) => {
    const next = openIds.filter((x) => x !== id);
    setOpenIds(next);
    setDraftIds((prev) => prev.filter((x) => x !== id));
    if (activeId === id) setActiveId(next.length ? next[next.length - 1] : null);
  };

  const handleSelect = (id: string) => {
    openNote(id);
    const record = allRecords(data).find((r) => r.id === id);
    if (record?.type === "civilization") {
      const previous = lastCivRef.current;
      if (previous && previous !== id) {
        const fact = funFactBetween(previous, id, data.civilizations);
        if (fact) setFunFact({ aId: previous, bId: id, fact });
      }
      lastCivRef.current = id;
    }
  };

  // Midway insert: clicking empty lane space drafts a new event, prefilled with
  // the civilization + the rough year from the click position, opened for editing.
  const handleInsert = (civilizationId: string, year: number) => {
    const id = `event_new_${Date.now()}`;
    const draft = {
      type: "event",
      id,
      title: "",
      span: { startYear: year, displayLabel: `~${formatYear(year)}`, certainty: "approximate" },
      civilizationId,
      notes: "",
      metadata: {},
    } as HistoryWallData["events"][number];
    setData((prev) => ({ ...prev, events: [...prev.events, draft] }));
    setDraftIds((prev) => [...prev, id]);
    openNote(id);
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
          onSelect={handleSelect}
          onInsert={handleInsert}
          onZoomIn={() => setZoom((z) => clampZoom(z * 1.25))}
          onZoomOut={() => setZoom((z) => clampZoom(z / 1.25))}
          onZoomFit={() => setZoom(1)}
        />
      ) : (
        <HistoryMap data={data} activeId={activeId} onSelect={handleSelect} />
      )}

      {openIds
        .map((id) => allRecords(data).find((r) => r.id === id))
        .filter((r): r is HistoryWallRecord => Boolean(r))
        .map((record, index) => (
          <FloatingNote
            key={record.id}
            index={index}
            record={record}
            saving={saving}
            suggestion={suggestFromNotes(record)}
            civilizationTitles={civilizationTitles}
            startEditing={draftIds.includes(record.id)}
            onClose={() => closeNote(record.id)}
            onSave={handleSave}
            onSelect={handleSelect}
            onExplore={() => console.log("Explore suggestion for", record.id)}
          />
        ))}
      {funFact && (
        <FunFactBurst
          aId={funFact.aId}
          bId={funFact.bId}
          fact={funFact.fact}
          onDone={() => setFunFact(null)}
        />
      )}
    </div>
  );
}
