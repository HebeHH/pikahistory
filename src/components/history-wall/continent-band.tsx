"use client";

import type { CSSProperties } from "react";

import type { VisualReference } from "@/contracts/history-wall.types";
import type { BandLayout } from "@/lib/history-wall/layout";
import { eraSentimentColor } from "@/lib/history-wall/layout";
import { bandHeight, laneY, xForYear } from "@/lib/history-wall/time-scale";

interface ContinentBandProps {
  band: BandLayout;
  zoom: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** Emoji glyph, image asset, or a Material Symbol fallback inside a circle. */
function IconGlyph({ visual, fallback }: { visual?: VisualReference; fallback: string }) {
  if (visual?.kind === "emoji") return <span style={{ fontSize: 17 }}>{visual.value}</span>;
  if (visual && (visual.kind === "asset" || visual.kind === "url")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={visual.value} alt={visual.alt ?? ""} style={{ width: 20, height: 20, objectFit: "contain" }} />;
  }
  return <span className="material-symbols-outlined" style={{ fontSize: 19 }}>{fallback}</span>;
}

export default function ContinentBand({ band, zoom, activeId, onSelect }: ContinentBandProps) {
  const { style, laneCount, civs } = band;
  const height = bandHeight(laneCount);

  return (
    <div
      className="relative"
      style={{ height, background: style.tint, borderBottom: "1px solid #eae3d2" }}
    >
      {/* Lane baselines */}
      {Array.from({ length: laneCount }).map((_, lane) => (
        <div
          key={lane}
          style={{
            position: "absolute",
            left: 140,
            right: 24,
            top: laneY(lane),
            borderTop: `1px dashed ${style.labelColor}`,
            opacity: 0.3,
          }}
        />
      ))}

      {/* Sticky band label */}
      <div
        className="sticky flex flex-col justify-center"
        style={{
          left: 0,
          width: 132,
          height,
          zIndex: 8,
          background: style.tint,
          borderRight: "1px solid #e0d8c4",
          paddingLeft: 18,
          float: "left",
        }}
      >
        <span className="font-serif" style={{ fontSize: 17, fontWeight: 600, color: style.labelColor }}>
          {style.name}
        </span>
        <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--faint)" }}>
          CONTINENT
        </span>
      </div>

      {/* Records */}
      {civs.map(({ civ, lane, events, eras }) => {
        const start = xForYear(civ.span.startYear, zoom);
        const end = xForYear(civ.span.endYear ?? civ.span.startYear, zoom);
        const width = Math.max(end - start, 26);
        const y = laneY(lane);
        const civActive = civ.id === activeId;

        return (
          <div key={civ.id}>
            {/* Era sentiment underlays */}
            {eras.map((era) => {
              const es = xForYear(era.span.startYear, zoom);
              const ee = xForYear(era.span.endYear ?? era.span.startYear, zoom);
              const eActive = era.id === activeId;
              return (
                <button
                  key={era.id}
                  type="button"
                  title={`${era.title} — ${era.span.displayLabel}`}
                  onClick={() => onSelect(era.id)}
                  style={{
                    position: "absolute",
                    left: es,
                    top: y + 6,
                    width: Math.max(ee - es, 10),
                    height: 8,
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    background: eActive ? "var(--accent)" : eraSentimentColor(era.value),
                    boxShadow: eActive ? "0 0 8px rgba(232,169,12,.5)" : undefined,
                    zIndex: 2,
                  }}
                />
              );
            })}

            {/* Civilization stream bar */}
            <div
              style={{
                position: "absolute",
                left: start,
                top: y - 3,
                width,
                height: 6,
                borderRadius: 3,
                background: civActive ? "var(--accent)" : style.segColor,
                boxShadow: civActive ? "0 0 10px rgba(232,169,12,.5)" : undefined,
                zIndex: 3,
              }}
            />

            {/* Civilization label */}
            <div
              style={{
                position: "absolute",
                left: start - 14,
                top: y - 46,
                whiteSpace: "nowrap",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              <div
                className="font-serif"
                style={{ fontSize: 11.5, fontWeight: 600, color: civActive ? "var(--accent-deep)" : "#3a342b" }}
              >
                {civ.title}
              </div>
              <div className="font-mono" style={{ fontSize: 8.5, color: "var(--faint)" }}>
                {civ.span.displayLabel}
              </div>
            </div>

            {/* Civilization icon */}
            <IconButton
              left={start - 17}
              top={y - 17}
              size={34}
              active={civActive}
              onClick={() => onSelect(civ.id)}
              title={civ.title}
              dataCivId={civ.id}
            >
              <IconGlyph visual={civ.icon} fallback="account_balance" />
            </IconButton>

            {/* Event icons on the same lane */}
            {events.map((event) => {
              const ex = xForYear(event.span.startYear, zoom);
              const eventActive = event.id === activeId;
              return (
                <IconButton
                  key={event.id}
                  left={ex - 13}
                  top={y - 13}
                  size={26}
                  active={eventActive}
                  onClick={() => onSelect(event.id)}
                  title={`${event.title} — ${event.span.displayLabel}`}
                >
                  <IconGlyph visual={event.visual} fallback="event" />
                </IconButton>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface IconButtonProps {
  dataCivId?: string;
  left: number;
  top: number;
  size: number;
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function IconButton({ dataCivId, left, top, size, active, onClick, title, children }: IconButtonProps) {
  const base: CSSProperties = {
    position: "absolute",
    left,
    top,
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: active ? 6 : 5,
    transition: "all .2s",
    color: active ? "var(--text)" : "var(--muted)",
  };
  const skin: CSSProperties = active
    ? {
        background: "var(--accent)",
        border: "1.5px solid var(--accent)",
        boxShadow: "0 0 0 5px rgba(232,169,12,.16), 0 4px 12px rgba(232,169,12,.4)",
        animation: "pulse 2s infinite",
      }
    : {
        background: "#fbf8f0",
        border: "1.5px solid #d9cfb8",
        boxShadow: "0 1px 3px rgba(0,0,0,.05)",
      };
  return (
    <button type="button" title={title} onClick={onClick} data-civ-id={dataCivId} style={{ ...base, ...skin }}>
      {children}
    </button>
  );
}
