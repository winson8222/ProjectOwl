"use client";

import { useEffect, useState } from "react";

/**
 * The sloth working a calculator, for the receipt-scan wait.
 *
 * Replaces the owl that used to sit here. The button that starts a scan shows
 * the sloth, so the thing that appears while it works should be the same
 * character — an owl turning up mid-flow read as a second mascot.
 *
 * The paws tap in alternation and the display scrambles. The digits are
 * deliberately meaningless: Gemini gives us nothing to report until it
 * returns, and a figure that looked like a running total would be inventing
 * one. This is a character being busy, not a progress indicator.
 */
export default function SlothCalculating({ size = 190 }: { size?: number }) {
  const [display, setDisplay] = useState("0.00");

  useEffect(() => {
    // Slow enough to read as deliberate keying rather than a slot machine.
    const t = setInterval(() => {
      const n = Math.random() * 400;
      setDisplay(n.toFixed(2));
    }, 260);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ width: size }} className="relative select-none">
      <svg viewBox="0 0 170 168" width={size} height={size * (168 / 170)} fill="none">
        {/* ── Body ─────────────────────────────────────────────── */}
        <path
          d="M85 44c-24 0-38 20-38 44 0 16 5 28 12 36h52c7-8 12-20 12-36 0-24-14-44-38-44Z"
          fill="currentColor"
        />

        {/* Arms reaching down to the keys. Drawn behind the paws so the paw
            shapes sit on top of the limb. */}
        <path
          d="M56 92c-6 12-6 26 4 36"
          stroke="currentColor"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M114 92c6 12 6 26-4 36"
          stroke="currentColor"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* ── Head ─────────────────────────────────────────────── */}
        <ellipse cx="85" cy="47" rx="35" ry="31" fill="currentColor" />
        <ellipse cx="85" cy="51" rx="25" ry="23" className="sloth-face" />

        <ellipse
          cx="72" cy="47" rx="10.5" ry="12"
          className="sloth-patch"
          transform="rotate(-16 72 47)"
        />
        <ellipse
          cx="98" cy="47" rx="10.5" ry="12"
          className="sloth-patch"
          transform="rotate(16 98 47)"
        />
        {/* Eyes look DOWN at the calculator — the one detail that sells the
            whole thing as concentration rather than a portrait. */}
        <circle cx="73" cy="51" r="4" className="sloth-eye" />
        <circle cx="97" cy="51" r="4" className="sloth-eye" />

        <ellipse cx="85" cy="61" rx="4.6" ry="3.4" className="sloth-nose" />
        <path
          d="M79.5 66.5c3.2 3.2 7.8 3.2 11 0"
          className="sloth-smile"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Visor */}
        <path
          d="M50 26.5c0-11.5 15.6-20 35-20s35 8.5 35 20c0 2.9-2.6 4.6-6 4.6H56c-3.4 0-6-1.7-6-4.6Z"
          className="sloth-visor"
        />
        <path
          d="M54 23.5c5.8-5.2 17.6-8.9 31-8.9s25.2 3.7 31 8.9"
          className="sloth-visor-seam"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Calculator ───────────────────────────────────────── */}
        <rect x="38" y="120" width="94" height="44" rx="7" className="calc-body" />
        <rect x="45" y="126" width="80" height="13" rx="3" className="calc-screen" />

        {/* Keys */}
        {[0, 1, 2, 3].map((c) =>
          [0, 1].map((r) => (
            <rect
              key={`${c}-${r}`}
              x={47 + c * 19}
              y={144 + r * 9}
              width="14"
              height="6.5"
              rx="2"
              className="calc-key"
            />
          ))
        )}

        {/* ── Paws, tapping ────────────────────────────────────── */}
        <g className="paw paw-l">
          <ellipse cx="64" cy="140" rx="9" ry="6.5" fill="currentColor" />
          <path
            d="M58 143.5c1.6 2 3.6 3 6 3s4.4-1 6-3"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </g>
        <g className="paw paw-r">
          <ellipse cx="106" cy="140" rx="9" ry="6.5" fill="currentColor" />
          <path
            d="M100 143.5c1.6 2 3.6 3 6 3s4.4-1 6-3"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>

      {/* The running figure. HTML rather than SVG text so it can use the
          app's tabular numerals and not reflow as digits change. */}
      <span
        className="absolute tabular font-mono"
        style={{
          left: "26.5%",
          top: "75.5%",
          width: "47%",
          textAlign: "right",
          fontSize: size * 0.055,
          color: "var(--color-blueberry-900)",
          letterSpacing: "0.5px",
        }}
        aria-hidden
      >
        {display}
      </span>
    </div>
  );
}
