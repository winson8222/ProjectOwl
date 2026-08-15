"use client";

/**
 * The ProjectOwl mark, drawn as SVG so it can be animated and re-tinted.
 *
 * Previously the owl only existed as flattened PNGs in public/icons (and in
 * the old #3a85c5 blue — the SVG they were generated from was never
 * committed). This is the source of truth now: the scan loader animates it,
 * and the icon set can be re-rendered from it.
 *
 * phase:
 *   "assemble" — face, tufts, eyes and beak arrive in sequence
 *   "reading"  — pupils sweep left/right with occasional blinks
 *   "done"     — eyes curve into a contented crescent
 *   "still"    — no animation at all; for the header lockup, where a blinking
 *                logo would be a distraction rather than a delight
 */
export type OwlPhase = "still" | "assemble" | "reading" | "done";

export default function OwlMark({
  phase = "reading",
  size = 160,
  className = "",
}: {
  phase?: OwlPhase;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={`owl owl-${phase} ${className}`}
      role="img"
      aria-label="ProjectOwl"
    >
      {/* Ear tufts — behind the face so they read as sticking out from it. */}
      <g className="owl-tufts" fill="currentColor">
        <path d="M52 34 L86 62 L58 76 Z" />
        <path d="M148 34 L114 62 L142 76 Z" />
      </g>

      {/* Face */}
      <circle
        className="owl-face"
        cx="100"
        cy="108"
        r="62"
        fill="currentColor"
      />

      {/* Eyes. The whole group scales on the Y axis to blink. */}
      <g className="owl-eyes">
        <g className="owl-eye owl-eye-l">
          <circle cx="78" cy="100" r="21" className="owl-iris" />
          <circle cx="71" cy="93" r="6.5" className="owl-glint" />
        </g>
        <g className="owl-eye owl-eye-r">
          <circle cx="122" cy="100" r="21" className="owl-iris" />
          <circle cx="115" cy="93" r="6.5" className="owl-glint" />
        </g>
      </g>

      {/* Contented crescents, shown only in the done phase. */}
      <g className="owl-happy" strokeWidth="7" strokeLinecap="round">
        <path d="M64 104 Q78 88 92 104" />
        <path d="M108 104 Q122 88 136 104" />
      </g>

      {/* Beak — lands last, with a bit of overshoot. */}
      <path className="owl-beak" d="M100 128 L110 146 L90 146 Z" />
    </svg>
  );
}
