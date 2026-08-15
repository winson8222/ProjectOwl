/**
 * Activity glyphs, replacing the emoji the feed used to lead each row with
 * (🧾 💸 ✨ ➕ 🔗).
 *
 * Emoji render at a different weight, size and colour on every platform, so a
 * column of them never lines up — and they can't take the muted ink the rest
 * of the row uses. These are stroked on a 24 box like the nav icons, and take
 * currentColor.
 */

const base = {
  width: 19,
  height: 19,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** A receipt with a torn foot — an expense. */
export function ReceiptIcon() {
  return (
    <svg {...base}>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V3.5Z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </svg>
  );
}

/** A banknote — a payment between two people. */
export function NoteIcon() {
  return (
    <svg {...base}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

/** A new group. */
export function GroupAddedIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.25 19.5a5.75 5.75 0 0 1 11.5 0" />
      <path d="M18 7.5v5M15.5 10h5" />
    </svg>
  );
}

/** Someone added to a group. */
export function MemberAddedIcon() {
  return (
    <svg {...base}>
      <circle cx="10" cy="8.5" r="3.4" />
      <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M19 6.5v5M16.5 9h5" />
    </svg>
  );
}

/** Someone joined by invite link. */
export function LinkJoinedIcon() {
  return (
    <svg {...base}>
      <path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </svg>
  );
}
