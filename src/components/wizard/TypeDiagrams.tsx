/**
 * Diagrams of what each transaction type actually does, in place of the 🧾/💸
 * emoji this used to use.
 *
 * They aren't decoration — the shape IS the explanation. An expense fans one
 * payer out to several people; a payment is one person to one person. Someone
 * who can't be bothered to read the label can still tell the two apart.
 */

const svg = {
  width: 44,
  height: 44,
  viewBox: "0 0 44 44",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** One payer at the top, fanning out to three shares. */
export function ExpenseDiagram({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <circle cx="22" cy="9" r="4.5" fill="currentColor" stroke="none" />
      <path d="M22 14.5v5" />
      <path d="M9 33v-6.5a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2V33" />
      <path d="M22 19.5v5" />
      <circle cx="9" cy="36" r="3.25" />
      <circle cx="22" cy="36" r="3.25" />
      <circle cx="35" cy="36" r="3.25" />
    </svg>
  );
}

/** One person straight across to one other. */
export function PaymentDiagram({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <circle cx="9" cy="22" r="5" fill="currentColor" stroke="none" />
      <circle cx="35" cy="22" r="5" />
      <path d="M17 22h10" />
      <path d="M24 18.5 27.5 22 24 25.5" />
    </svg>
  );
}

/**
 * ItreAI: a receipt inside camera viewfinder brackets, with a beam sweeping
 * down it. Deliberately not sparkles — the ✨-on-a-button trope is the single
 * most generic way to signal "AI", and it says nothing about what this does.
 * Brackets + beam say "it looks at your receipt", which is the actual feature.
 */
export function ScanDiagram({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      {/* viewfinder corners */}
      <path d="M4 13V7a3 3 0 0 1 3-3h6" />
      <path d="M31 4h6a3 3 0 0 1 3 3v6" />
      <path d="M40 31v6a3 3 0 0 1-3 3h-6" />
      <path d="M13 40H7a3 3 0 0 1-3-3v-6" />
      {/* receipt */}
      <path d="M15 11h14v22l-2.3-1.6L24.4 33l-2.4-1.6L19.6 33l-2.3-1.6L15 33z" />
      <path d="M19 17h6M19 22h6" />
      {/* scan beam */}
      <path
        d="M11 22h22"
        strokeWidth="2"
        className="scan-beam"
        style={{ transformOrigin: "22px 22px" }}
      />
    </svg>
  );
}

/** Manual entry: a keypad. Says "you'll be typing" without a keyboard emoji. */
export function ManualDiagram({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <rect x="6" y="8" width="32" height="28" rx="3" />
      <circle cx="14" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="22" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="30" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="25" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="22" cy="25" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="30" cy="25" r="1.6" fill="currentColor" stroke="none" />
      <path d="M14 31h16" />
    </svg>
  );
}
