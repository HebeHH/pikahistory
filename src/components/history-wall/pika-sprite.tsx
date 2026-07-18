"use client";

/**
 * PikaSprite — an original lightning-mascot doodle (Pikachu-inspired, drawn
 * here rather than copied from official art). Yellow body, bolt tail, rosy
 * cheeks. `mood` swaps the face; animation is driven by CSS classes.
 */
export default function PikaSprite({
  size = 34,
  mood = "happy",
  className = "",
}: {
  size?: number;
  mood?: "happy" | "wink" | "spark";
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Pika mascot"
      style={{ overflow: "visible" }}
    >
      {/* tail: lightning bolt */}
      <path
        d="M6 30 L15 26 L11 32 L18 30 L9 40 L12 33 L5 35 Z"
        fill="#f6c915"
        stroke="#8a6a0c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* ears */}
      <path d="M15 12 L11 1 L20 9 Z" fill="#f7d426" stroke="#3a2f16" strokeWidth="1.2" />
      <path d="M33 12 L37 1 L28 9 Z" fill="#f7d426" stroke="#3a2f16" strokeWidth="1.2" />
      <path d="M13.5 5 L11 1 L15 4 Z" fill="#2b2620" />
      <path d="M34.5 5 L37 1 L33 4 Z" fill="#2b2620" />
      {/* body / head */}
      <circle cx="24" cy="26" r="15" fill="#f7d426" stroke="#3a2f16" strokeWidth="1.4" />
      {/* cheeks */}
      <circle cx="15" cy="29" r="3.4" fill="#e8563a" />
      <circle cx="33" cy="29" r="3.4" fill="#e8563a" />
      {/* eyes */}
      {mood === "wink" ? (
        <path d="M16.5 21 q2.5 2 5 0" stroke="#2b2620" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : (
        <circle cx="19" cy="22" r="2.4" fill="#2b2620" />
      )}
      <circle cx="29" cy="22" r="2.4" fill="#2b2620" />
      {mood !== "wink" && <circle cx="19.8" cy="21.2" r="0.8" fill="#fff" />}
      <circle cx="29.8" cy="21.2" r="0.8" fill="#fff" />
      {/* mouth */}
      <path d="M22 27 q2 2 4 0" stroke="#2b2620" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {mood === "spark" && (
        <text x="38" y="14" fontSize="10" fill="#e8a90c">
          ⚡
        </text>
      )}
    </svg>
  );
}
