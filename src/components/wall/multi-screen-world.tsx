"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

import type {
  HistoryWallData,
  VisualReference,
} from "@/contracts/history-wall.types";
import {
  buildWallLayout,
  eraSentimentColor,
  type BandLayout,
} from "@/lib/history-wall/layout";
import { yearToWorldX } from "@/lib/wall/coordinates";

const WORLD_START = -3600;
const WORLD_END = 2200;
const BAND_LABEL_HEIGHT = 72;
const BAND_GAP = 24;
const LANE_HEIGHT = 168;
const BAND_LABEL_X = yearToWorldX(-980) - WORLD_START;

function bandHeight(band: BandLayout) {
  return BAND_LABEL_HEIGHT + band.laneCount * LANE_HEIGHT;
}

function laneY(bandTop: number, lane: number) {
  return bandTop + BAND_LABEL_HEIGHT + lane * LANE_HEIGHT + 82;
}

function IconGlyph({
  visual,
  fallback,
}: {
  visual?: VisualReference;
  fallback: string;
}) {
  if (visual?.kind === "emoji") {
    return <span style={{ fontSize: 34 }}>{visual.value}</span>;
  }
  if (visual && (visual.kind === "asset" || visual.kind === "url")) {
    return (
      <span
        aria-label={visual.alt ?? ""}
        role="img"
        style={{
          backgroundImage: `url(${visual.value})`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          display: "block",
          height: 42,
          width: 42,
        }}
      />
    );
  }
  return (
    <span className="material-symbols-outlined" style={{ fontSize: 38 }}>
      {fallback}
    </span>
  );
}

function WorldButton({
  active,
  children,
  label,
  left,
  onClick,
  size,
  top,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  left: number;
  onClick: () => void;
  size: number;
  top: number;
}) {
  const style: CSSProperties = {
    alignItems: "center",
    background: active ? "var(--accent)" : "var(--surface)",
    border: active ? "3px solid var(--accent)" : "3px solid #d9cfb8",
    borderRadius: "50%",
    boxShadow: active
      ? "0 0 0 12px rgba(232,169,12,.16), 0 8px 24px rgba(138,106,12,.34)"
      : "0 4px 10px rgba(43,38,32,.12)",
    color: active ? "var(--text)" : "var(--muted)",
    cursor: "pointer",
    display: "flex",
    height: size,
    justifyContent: "center",
    left,
    padding: 0,
    position: "absolute",
    top,
    width: size,
    zIndex: active ? 8 : 6,
  };

  return (
    <button aria-label={label} onClick={onClick} style={style} title={label} type="button">
      {children}
    </button>
  );
}

export default function MultiScreenWorld({
  activeId,
  data,
  onSelect,
}: {
  activeId: string | null;
  data: HistoryWallData;
  onSelect: (id: string) => void;
}) {
  const bands = useMemo(() => buildWallLayout(data), [data]);
  const positionedBands = useMemo(
    () =>
      bands.map((band, index) => ({
        band,
        top:
          30 +
          bands
            .slice(0, index)
            .reduce(
              (total, previous) => total + bandHeight(previous) + BAND_GAP,
              0,
            ),
      })),
    [bands],
  );

  return (
    <div
      style={{
        height:
          bands.reduce((total, band) => total + bandHeight(band) + BAND_GAP, 30) +
          160,
        left: WORLD_START,
        position: "absolute",
        top: 0,
        width: WORLD_END - WORLD_START,
      }}
    >
      {positionedBands.map(({ band, top: bandTop }) => {
        const height = bandHeight(band);

        return (
          <section
            aria-label={`${band.style.name} civilizations`}
            key={band.style.key}
            style={{
              background: band.style.tint,
              borderBottom: "2px solid #ded5c1",
              borderTop: "2px solid rgba(255,255,255,.62)",
              height,
              left: 0,
              overflow: "hidden",
              position: "absolute",
              top: bandTop,
              width: "100%",
            }}
          >
            <div
              style={{
                alignItems: "baseline",
                display: "flex",
                gap: 22,
                left: BAND_LABEL_X,
                position: "absolute",
                top: 22,
              }}
            >
              <strong
                className="font-serif"
                style={{ color: band.style.labelColor, fontSize: 40 }}
              >
                {band.style.name}
              </strong>
              <span
                className="font-mono"
                style={{ color: "var(--faint)", fontSize: 19, letterSpacing: ".18em" }}
              >
                CIVILIZATION BAND
              </span>
            </div>

            {Array.from({ length: band.laneCount }).map((_, lane) => (
              <div
                key={lane}
                style={{
                  borderTop: `2px dashed ${band.style.labelColor}`,
                  left: 32,
                  opacity: 0.2,
                  position: "absolute",
                  right: 32,
                  top: laneY(0, lane),
                }}
              />
            ))}

            {band.civs.map(({ civ, eras, events, lane }) => {
              const start = yearToWorldX(civ.span.startYear) - WORLD_START;
              const end = yearToWorldX(civ.span.endYear ?? civ.span.startYear) - WORLD_START;
              const y = laneY(0, lane);
              const active = civ.id === activeId;

              return (
                <div key={civ.id}>
                  {eras.map((era) => {
                    const eraStart = yearToWorldX(era.span.startYear) - WORLD_START;
                    const eraEnd =
                      yearToWorldX(era.span.endYear ?? era.span.startYear) - WORLD_START;
                    return (
                      <button
                        aria-label={`${era.title}, ${era.span.displayLabel}`}
                        key={era.id}
                        onClick={() => onSelect(era.id)}
                        style={{
                          background:
                            era.id === activeId
                              ? "var(--accent)"
                              : eraSentimentColor(era.value),
                          border: "none",
                          borderRadius: 9,
                          cursor: "pointer",
                          height: 18,
                          left: eraStart,
                          minWidth: 22,
                          padding: 0,
                          position: "absolute",
                          top: y + 17,
                          width: Math.max(eraEnd - eraStart, 22),
                          zIndex: 4,
                        }}
                        title={`${era.title} — ${era.span.displayLabel}`}
                        type="button"
                      />
                    );
                  })}

                  <div
                    style={{
                      background: active ? "var(--accent)" : band.style.segColor,
                      borderRadius: 8,
                      boxShadow: active ? "0 0 20px rgba(232,169,12,.55)" : undefined,
                      height: 14,
                      left: start,
                      minWidth: 44,
                      position: "absolute",
                      top: y - 7,
                      width: Math.max(end - start, 44),
                      zIndex: 3,
                    }}
                  />

                  <div
                    style={{
                      left: start - 8,
                      pointerEvents: "none",
                      position: "absolute",
                      top: y - 93,
                      whiteSpace: "nowrap",
                      zIndex: 5,
                    }}
                  >
                    <div
                      className="font-serif"
                      style={{
                        color: active ? "var(--accent-deep)" : "#3a342b",
                        fontSize: 34,
                        fontWeight: 650,
                      }}
                    >
                      {civ.title}
                    </div>
                    <div
                      className="font-mono"
                      style={{ color: "var(--faint)", fontSize: 20, marginTop: 3 }}
                    >
                      {civ.span.displayLabel}
                    </div>
                  </div>

                  <WorldButton
                    active={active}
                    label={civ.title}
                    left={start - 34}
                    onClick={() => onSelect(civ.id)}
                    size={68}
                    top={y - 34}
                  >
                    <IconGlyph fallback="account_balance" visual={civ.icon} />
                  </WorldButton>

                  {events.map((event) => {
                    const eventX = yearToWorldX(event.span.startYear) - WORLD_START;
                    return (
                      <WorldButton
                        active={event.id === activeId}
                        key={event.id}
                        label={`${event.title}, ${event.span.displayLabel}`}
                        left={eventX - 25}
                        onClick={() => onSelect(event.id)}
                        size={50}
                        top={y - 25}
                      >
                        <IconGlyph fallback="event" visual={event.visual} />
                      </WorldButton>
                    );
                  })}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
