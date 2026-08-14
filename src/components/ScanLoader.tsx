"use client";

import { useEffect, useState } from "react";
import OwlMark, { type OwlPhase } from "./OwlMark";
import Portal from "@/components/Portal";

/**
 * Full-screen takeover while ItreAI reads a receipt.
 *
 * Replaces a 64px circle containing ⏳ and the word "Processing…".
 *
 * The status line steps through what is genuinely happening rather than
 * showing a progress bar: Gemini doesn't stream, so there is no real
 * completion figure to report and any percentage would be invented. The
 * copy advances on a timer and parks on the last line until the request
 * actually returns — it never claims to be finished.
 */
const STAGES = [
  "Reading your receipt…",
  "Finding the items…",
  "Adding everything up…",
];

export default function ScanLoader({ done = false }: { done?: boolean }) {
  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<OwlPhase>("assemble");

  useEffect(() => {
    const t = setTimeout(() => setPhase("reading"), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (done) {
      setPhase("done");
      return;
    }
    // Park on the final stage rather than looping — cycling forever would
    // suggest the work restarted.
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 2600);
    return () => clearTimeout(t);
  }, [stage, done]);

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-8 px-8"
      style={{
        background:
          "linear-gradient(160deg, var(--color-blueberry-600) 0%, var(--color-blueberry-900) 100%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Ghosted receipt behind the owl, with a beam running down it. */}
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden
          className="absolute rounded-[10px] scan-page"
          style={{
            width: 108,
            height: 148,
            background: "rgba(255,255,255,0.09)",
          }}
        />
        <OwlMark phase={phase} size={168} className="relative text-white" />
      </div>

      <div className="text-center">
        <p className="text-title2 font-bold text-white">
          {done ? "Got it" : "ItreAI"}
        </p>
        <p
          key={stage}
          className="text-body mt-1.5 animate-fade-in"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          {done ? "Here's what was on the receipt" : STAGES[stage]}
        </p>
      </div>
    </div>
    </Portal>
  );
}
