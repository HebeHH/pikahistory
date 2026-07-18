"use client";

import { useMemo, useState } from "react";

import type {
  Civilization,
  Era,
  HistoryEvent,
  HistoryWallData,
  HistoryWallRecord,
} from "@/contracts/history-wall.types";

import {
  TimelineInputLayer,
  type TimelineInputMode,
  yearAtPointer,
} from "./TimelineInputLayer";
import { civilizationColor, eraColor } from "./timeline-colors";

const DOMAIN_START = -3200;
const DOMAIN_END = 2025;
const TRACK_WIDTH = 1800;
const ROW_HEIGHT = 104;
const INTERACTION_HEIGHT = 88;

function position(year: number) {
  return ((year - DOMAIN_START) / (DOMAIN_END - DOMAIN_START)) * TRACK_WIDTH;
}

function width(startYear: number, endYear = startYear) {
  return Math.max(8, position(endYear) - position(startYear));
}

function formatYear(year: number) {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

function fullNotes(record: HistoryWallRecord) {
  return record.details?.markdown || record.notes || "No notes yet.";
}

export function TimelineWall({ data }: { data: HistoryWallData }) {
  const [selected, setSelected] = useState<HistoryWallRecord>();
  const [inputMode, setInputMode] = useState<TimelineInputMode>("inspect");
  const [inputMessage, setInputMessage] = useState(
    "Choose a tool, then interact directly with a civilization row.",
  );
  const civilizationsById = useMemo(
    () => new Map(data.civilizations.map((civilization) => [civilization.id, civilization])),
    [data.civilizations],
  );
  const rowByCivilizationId = useMemo(
    () => new Map(data.civilizations.map((civilization, index) => [civilization.id, index])),
    [data.civilizations],
  );
  const singleEvents = data.events.filter((event) => !event.interaction);
  const interactions = data.events.filter((event) => event.interaction);

  return (
    <main className="wall-shell">
      <header className="wall-header">
        <div>
          <p className="eyebrow">Pika History</p>
          <h1>Civilizations in context</h1>
        </div>
        <div className="legend" aria-label="Timeline legend">
          <span><i className="legend-span" /> civilization / era span</span>
          <span><i className="legend-event" /> event · tap for detail</span>
          <span><i className="legend-link" /> interaction · links 2+ civilizations</span>
        </div>
      </header>

      <TimelineInputLayer
        domainEnd={DOMAIN_END}
        domainStart={DOMAIN_START}
        message={inputMessage}
        mode={inputMode}
        onModeChange={setInputMode}
      />

      <section className="timeline-scroll" aria-label="History timeline">
        <div className="timeline-track" style={{ width: TRACK_WIDTH }}>
          <div className="year-ruler">
            {[-3000, -2000, -1000, 1, 1000, 1500, 2025].map((year) => (
              <span key={year} style={{ left: position(year) }}>
                {formatYear(year)}
              </span>
            ))}
          </div>

          <div className="interaction-shelf" style={{ height: INTERACTION_HEIGHT }}>
            {interactions.map((event) => (
              <InteractionGraphic
                event={event}
                key={event.id}
                onSelect={() => setSelected(event)}
                rowByCivilizationId={rowByCivilizationId}
              />
            ))}
          </div>

          <div className="civilization-rows">
            {data.civilizations.map((civilization) => (
              <CivilizationRow
                civilization={civilization}
                eras={data.eras.filter(
                  (era) => era.civilizationId === civilization.id,
                )}
                events={singleEvents.filter(
                  (event) => event.civilizationId === civilization.id,
                )}
                key={civilization.id}
                inputMode={inputMode}
                onDraft={setInputMessage}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      </section>

      {selected ? (
        <aside className="detail-drawer" aria-live="polite">
          <button onClick={() => setSelected(undefined)} type="button" aria-label="Close detail">
            ×
          </button>
          <p className="eyebrow">{selected.type}</p>
          <h2>{selected.title}</h2>
          <p className="detail-date">{selected.span.displayLabel}</p>
          {selected.type === "event" && selected.interaction ? (
            <div className="participant-list">
              <strong>{selected.interaction.type.replaceAll("_", " ")}</strong>
              {selected.interaction.participants.map((participant) => (
                <span key={participant.civilizationId}>
                  {civilizationsById.get(participant.civilizationId)?.title ?? participant.civilizationId}
                  {` · ${participant.role.replaceAll("_", " ")}`}
                </span>
              ))}
            </div>
          ) : null}
          <div className="full-note">{fullNotes(selected)}</div>
          {selected.details?.tags.length ? (
            <div className="tag-list">
              {selected.details.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}

function CivilizationRow({
  civilization,
  eras,
  events,
  onSelect,
  inputMode,
  onDraft,
}: {
  civilization: Civilization;
  eras: Era[];
  events: HistoryEvent[];
  onSelect: (record: HistoryWallRecord) => void;
  inputMode: TimelineInputMode;
  onDraft: (message: string) => void;
}) {
  const color = civilizationColor(civilization);
  const [dragStart, setDragStart] = useState<number>();

  return (
    <div className="civilization-row" style={{ height: ROW_HEIGHT }}>
      <button
        className="civilization-span"
        onClick={() => onSelect(civilization)}
        style={{
          background: color,
          left: position(civilization.span.startYear),
          width: width(civilization.span.startYear, civilization.span.endYear),
        }}
        type="button"
      >
        {civilization.title}
      </button>
      <span className="continent-label" style={{ color }}>
        {civilization.location.continent.replaceAll("_", " ")}
      </span>
      {eras.map((era) => (
        <button
          className="era-span"
          key={era.id}
          onClick={() => onSelect(era)}
          style={{
            background: eraColor(civilization, era),
            borderColor: color,
            left: position(era.span.startYear),
            width: width(era.span.startYear, era.span.endYear),
          }}
          title={`${era.title} · value ${era.value}/5`}
          type="button"
        >
          {era.title}
        </button>
      ))}
      {events.map((event) => (
        <button
          className="event-marker"
          key={event.id}
          onClick={() => onSelect(event)}
          style={{ left: position(event.span.startYear) }}
          title={`Open full event: ${event.title}`}
          type="button"
        >
          <span>{event.visual?.kind === "emoji" ? event.visual.value : "•"}</span>
          {event.title}
        </button>
      ))}
      {inputMode !== "inspect" ? (
        <div
          aria-label={`Add ${inputMode} to ${civilization.title}`}
          className="row-input-layer"
          onPointerDown={(event) => {
            const year = yearAtPointer(
              event.clientX,
              event.currentTarget,
              DOMAIN_START,
              DOMAIN_END,
            );
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragStart(year);
            onDraft(
              inputMode === "event"
                ? `${civilization.title}: event selected at ${formatYear(year)}.`
                : `${civilization.title}: ${inputMode} starts at ${formatYear(year)}; drag to set the end.`,
            );
          }}
          onPointerUp={(event) => {
            if (dragStart === undefined) return;
            const pointerYear = yearAtPointer(
              event.clientX,
              event.currentTarget,
              DOMAIN_START,
              DOMAIN_END,
            );
            const start = Math.min(dragStart, pointerYear);
            const end = Math.max(dragStart, pointerYear);
            onDraft(
              inputMode === "event"
                ? `${civilization.title}: event at ${formatYear(dragStart)}. Open the full event form next.`
                : `${civilization.title}: ${inputMode} span ${formatYear(start)} → ${formatYear(end)}. Open its full form next.`,
            );
            setDragStart(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

function InteractionGraphic({
  event,
  rowByCivilizationId,
  onSelect,
}: {
  event: HistoryEvent;
  rowByCivilizationId: Map<string, number>;
  onSelect: () => void;
}) {
  if (!event.interaction) return null;
  const x = position(event.span.startYear);
  const participantRows = event.interaction.participants
    .map((participant) => rowByCivilizationId.get(participant.civilizationId))
    .filter((row): row is number => row !== undefined);
  const lastRow = Math.max(...participantRows, 0);

  return (
    <div className="interaction-graphic" style={{ left: x }}>
      <button onClick={onSelect} type="button">
        {event.interaction.type.replaceAll("_", " ")} · {event.title}
      </button>
      <i style={{ height: lastRow * ROW_HEIGHT + 70 }} />
      {participantRows.map((row) => (
        <b key={row} style={{ top: INTERACTION_HEIGHT + row * ROW_HEIGHT + 51 }} />
      ))}
    </div>
  );
}
