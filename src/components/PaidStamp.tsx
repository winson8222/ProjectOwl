"use client";

import { useEffect } from "react";
import { tapSuccess } from "@/lib/haptics";

const SPARKS = 10;

/**
 * PAID stamp for a balance that has reached genuinely zero.
 *
 * `celebrate` distinguishes the two states this has:
 *   true  — the moment of settling. Stamp thunks down, sparks scatter, haptic.
 *   false — the resting watermark seen on every later visit.
 *
 * A settled balance previously rendered nothing at all (the cash/Gandhi rain
 * keys off the sign of netBalance, so zero fell through to null) — meaning the
 * payoff of the entire app was marked by animation stopping.
 */
export default function PaidStamp({
  celebrate = false,
  label = "PAID",
}: {
  celebrate?: boolean;
  label?: string;
}) {
  useEffect(() => {
    if (celebrate) tapSuccess();
  }, [celebrate]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      <div className="relative">
        {celebrate &&
          Array.from({ length: SPARKS }).map((_, i) => (
            <span
              key={i}
              className="spark"
              style={
                {
                  "--a": `${(360 / SPARKS) * i}deg`,
                  "--d": `${52 + (i % 3) * 14}px`,
                  animationDelay: `${0.22 + (i % 4) * 0.03}s`,
                } as React.CSSProperties
              }
            />
          ))}

        <div
          className={celebrate ? "stamp" : "stamp-resting"}
          style={{
            border: "3px solid var(--color-blueberry-600)",
            borderRadius: 8,
            padding: "6px 18px",
            color: "var(--color-blueberry-600)",
          }}
        >
          <span
            className="block font-bold tracking-[0.18em]"
            style={{ fontSize: 26, lineHeight: 1.1 }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
