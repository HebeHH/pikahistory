"use client";

import type { WallCamera } from "@/contracts/wall-session.schema";
import {
  chooseTickStep,
  formatRulerYear,
  tickYears,
  visibleYearRange,
} from "@/lib/wall/ruler-scale";
import { screenOffsetX, type WallScreen } from "@/lib/wall/screen-layout";

export default function FixedTimeRuler({
  camera,
  localScreen,
  screens,
  viewportWidth,
}: {
  camera: WallCamera;
  localScreen: WallScreen;
  screens: WallScreen[];
  viewportWidth: number;
}) {
  const offsetX = screenOffsetX(localScreen, screens);
  const [minYear, maxYear] = visibleYearRange(camera, offsetX, viewportWidth);
  const step = chooseTickStep(camera.zoom, 118);
  const ticks = tickYears(minYear, maxYear, step);

  return (
    <div
      aria-label="Visible historical years"
      style={{
        backdropFilter: "blur(7px)",
        background: "rgba(251,248,240,.92)",
        borderTop: "1px solid var(--line-4)",
        bottom: 0,
        height: 58,
        left: 0,
        overflow: "hidden",
        pointerEvents: "none",
        position: "absolute",
        right: 0,
        zIndex: 25,
      }}
    >
      <div
        style={{
          background: "var(--accent)",
          height: 3,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />
      {ticks.map((year) => {
        const left = (year - camera.x) * camera.zoom - offsetX;
        return (
          <div
            key={year}
            style={{
              left,
              position: "absolute",
              textAlign: "center",
              top: 3,
              transform: "translateX(-50%)",
            }}
          >
            <div style={{ background: "#b9aa8d", height: 11, margin: "0 auto 5px", width: 1 }} />
            <span
              className="font-mono"
              style={{ color: "var(--muted)", fontSize: 10, whiteSpace: "nowrap" }}
            >
              {formatRulerYear(year)}
            </span>
          </div>
        );
      })}
      <div
        className="font-mono"
        style={{
          bottom: 6,
          color: "var(--faint)",
          fontSize: 8,
          letterSpacing: ".16em",
          position: "absolute",
          right: 12,
        }}
      >
        TIME · {step}-YEAR INTERVALS
      </div>
    </div>
  );
}
