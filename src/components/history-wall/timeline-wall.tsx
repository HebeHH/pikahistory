"use client";

import { useEffect, useRef, useState } from "react";

import type { BandLayout } from "@/lib/history-wall/layout";
import {
  TICK_YEARS,
  bandHeight,
  formatYear,
  trackWidth,
  xForYear,
} from "@/lib/history-wall/time-scale";
import ContinentBand from "./continent-band";
import PikaSprite from "./pika-sprite";

interface TimelineWallProps {
  bands: BandLayout[];
  zoom: number;
  activeId: string | null;
  activeYear: number | null;
  onSelect: (id: string) => void;
  onInsert: (civilizationId: string, year: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
}

export default function TimelineWall({
  bands,
  zoom,
  activeId,
  activeYear,
  onSelect,
  onInsert,
  onZoomIn,
  onZoomOut,
  onZoomFit,
}: TimelineWallProps) {
  const width = trackWidth(zoom);
  const contentHeight = Math.max(
    600,
    46 + bands.reduce((h, b) => h + bandHeight(b.laneCount), 0),
  );

  const scrollRef = useRef<HTMLElement>(null);
  const [posterZoom, setPosterZoom] = useState(1);
  const posterZoomRef = useRef(1);
  useEffect(() => {
    posterZoomRef.current = posterZoom;
  }, [posterZoom]);

  // Trackpad pinch (ctrl+wheel) → visually scale the whole board toward the
  // pinch point, like zooming a static poster (icons + labels grow together),
  // rather than the +/− buttons which stretch the time axis.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // pinch gestures arrive as ctrl+wheel
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const prev = posterZoomRef.current;
      const next = Math.max(1, Math.min(4, prev * Math.exp(-e.deltaY * 0.01)));
      if (next === prev) return;
      const worldX = (el.scrollLeft + px) / prev;
      const worldY = (el.scrollTop + py) / prev;
      posterZoomRef.current = next;
      setPosterZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = worldX * next - px;
        el.scrollTop = worldY * next - py;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <section
        ref={scrollRef}
        className="h-full overflow-auto"
        style={{ background: "linear-gradient(180deg, var(--timeline-from), var(--timeline-to))" }}
      >
        <div style={{ width: width * posterZoom, height: contentHeight * posterZoom, minWidth: "100%", position: "relative" }}>
        <div
          className="relative"
          style={{ width, transform: posterZoom === 1 ? undefined : `scale(${posterZoom})`, transformOrigin: "0 0" }}
        >
          {/* Time ruler */}
          <div
            className="sticky top-0"
            style={{
              height: 46,
              background: "rgba(244,239,228,.96)",
              backdropFilter: "blur(2px)",
              borderBottom: "1px solid var(--line)",
              zIndex: 12,
            }}
          >
            <div
              className="sticky flex items-center font-mono"
              style={{
                left: 0,
                width: 132,
                height: 46,
                background: "var(--app-bg)",
                borderRight: "1px solid var(--line)",
                paddingLeft: 18,
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--muted)",
                float: "left",
              }}
            >
              TIMELINE
            </div>
            {TICK_YEARS.map((year) => (
              <div
                key={year}
                style={{
                  position: "absolute",
                  left: xForYear(year, zoom),
                  top: 6,
                  transform: "translateX(-50%)",
                  textAlign: "center",
                }}
              >
                <div className="font-mono" style={{ fontSize: 10, color: "#7c7360" }}>
                  {formatYear(year)}
                </div>
                <div style={{ width: 1, height: 8, background: "#cbbfa5", margin: "2px auto 0" }} />
              </div>
            ))}
          </div>

          {/* Context guide line (the "lit-up" indicator) */}
          {activeYear !== null && (
            <div
              style={{
                position: "absolute",
                left: xForYear(activeYear, zoom),
                top: 46,
                height: 600,
                width: 2,
                transform: "translateX(-50%)",
                background: "linear-gradient(180deg, var(--accent), rgba(232,169,12,.12))",
                zIndex: 3,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -5,
                  left: -4,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 0 4px rgba(232,169,12,.2)",
                }}
              />
            </div>
          )}

          {/* Pikachu hops to the selected item on the wall */}
          {activeYear !== null && (
            <div
              key={activeId ?? "pika"}
              className="pika-hop"
              style={{
                position: "absolute",
                left: xForYear(activeYear, zoom),
                top: 16,
                zIndex: 20,
                transform: "translateX(-50%)",
                pointerEvents: "none",
                filter: "drop-shadow(0 4px 5px rgba(43,38,32,.25))",
              }}
            >
              <PikaSprite size={40} mood="spark" />
            </div>
          )}

          {/* Continent bands */}
          {bands.map((band) => (
            <ContinentBand
              key={band.style.key}
              band={band}
              zoom={zoom}
              activeId={activeId}
              onSelect={onSelect}
              onInsert={onInsert}
            />
          ))}

          {bands.length === 0 && (
            <div className="p-10 text-center" style={{ color: "var(--muted)" }}>
              No records yet — add a civilization to get started.
            </div>
          )}
        </div>
        </div>
      </section>

      {/* Floating zoom control */}
      <div
        className="absolute flex flex-col overflow-hidden"
        style={{
          right: 18,
          bottom: 18,
          zIndex: 40,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          boxShadow: "0 6px 20px rgba(43,38,32,.14)",
        }}
      >
        <ZoomButton onClick={onZoomIn} label="add" height={38} />
        <div
          className="font-mono flex items-center justify-center"
          style={{ height: 30, fontSize: 11, color: "var(--muted)", borderTop: "1px solid #eee6d4", borderBottom: "1px solid #eee6d4" }}
        >
          {Math.round(zoom * posterZoom * 100)}%
        </div>
        <ZoomButton onClick={onZoomOut} label="remove" height={38} />
        <ZoomButton onClick={onZoomFit} label="fit_screen" height={34} border />
      </div>
    </div>
  );
}

function ZoomButton({
  onClick,
  label,
  height,
  border,
}: {
  onClick: () => void;
  label: string;
  height: number;
  border?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center transition-colors hover:bg-[#f4efe4]"
      style={{ width: 40, height, borderTop: border ? "1px solid #eee6d4" : undefined, color: "var(--muted)" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
        {label}
      </span>
    </button>
  );
}
