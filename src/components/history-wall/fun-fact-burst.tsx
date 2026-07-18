"use client";

import { useEffect, useMemo, useState } from "react";

import { playPikaZap } from "@/lib/history-wall/pika-sound";

interface FunFactBurstProps {
  aId: string;
  bId: string;
  fact: string;
  onDone: () => void;
}

interface Point {
  x: number;
  y: number;
}

const LIFETIME_MS = 4600;

function centerOf(civId: string): Point | null {
  const node = document.querySelector(`[data-civ-id="${CSS.escape(civId)}"]`);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Jagged lightning polyline points between a and b (viewport px). */
function boltPoints(a: Point, b: Point): string {
  const segments = 8;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // perpendicular
  const ny = dx / len;
  const pts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jitter = i === 0 || i === segments ? 0 : (Math.random() - 0.5) * Math.min(60, len * 0.18);
    pts.push(`${a.x + dx * t + nx * jitter},${a.y + dy * t + ny * jitter}`);
  }
  return pts.join(" ");
}

export default function FunFactBurst({ aId, bId, fact, onDone }: FunFactBurstProps) {
  const [ends, setEnds] = useState<{ a: Point; b: Point } | null>(null);

  useEffect(() => {
    const a = centerOf(aId);
    const b = centerOf(bId);
    // Measure both node positions after mount, then render the bolt between them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (a && b) setEnds({ a, b });
    playPikaZap(); // ⚡ cute electric zap as the shock lands
    const timer = setTimeout(onDone, LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [aId, bId, onDone]);

  const bolt = useMemo(() => (ends ? boltPoints(ends.a, ends.b) : ""), [ends]);
  // Card sits at the midpoint (or screen center if endpoints weren't found).
  const mid: Point = ends
    ? { x: (ends.a.x + ends.b.x) / 2, y: (ends.a.y + ends.b.y) / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      {ends && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {[ends.a, ends.b].map((p, i) => (
            <g key={i} transform={`translate(${p.x},${p.y})`}>
              <circle r={5} fill="#fff6d8" className="fun-flash" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <g key={deg} transform={`rotate(${deg})`}>
                  <line x1={0} y1={-8} x2={0} y2={-18} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" className="fun-ray" />
                </g>
              ))}
              <circle r={7} fill="var(--accent)" className="fun-node" />
            </g>
          ))}
          <polyline
            className="fun-bolt"
            points={bolt}
            fill="none"
            stroke="#fff6d8"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            className="fun-bolt"
            points={bolt}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}

      <div
        className="fun-card font-serif"
        style={{
          position: "absolute",
          left: Math.max(16, Math.min(mid.x, window.innerWidth - 16)),
          top: Math.max(16, mid.y),
          transform: "translate(-50%, -120%)",
          maxWidth: 320,
          background: "var(--surface)",
          border: "1px solid rgba(232,169,12,.5)",
          borderRadius: 12,
          padding: "12px 16px",
          boxShadow: "0 10px 30px rgba(43,38,32,.22), 0 0 0 4px rgba(232,169,12,.12)",
        }}
      >
        <div className="font-mono flex items-center gap-1" style={{ fontSize: 10, letterSpacing: ".12em", color: "var(--accent-deep)", marginBottom: 4 }}>
          <span className="material-symbols-outlined filled" style={{ fontSize: 14, color: "var(--accent)" }}>
            bolt
          </span>
          DID YOU KNOW?
        </div>
        <div style={{ fontSize: 14, fontStyle: "italic", color: "var(--body)", lineHeight: 1.5 }}>{fact}</div>
      </div>
    </div>
  );
}
