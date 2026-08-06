"use client";

/**
 * ItreAI sloth, for the floating scan button.
 *
 * Stand-in drawn in the same style as OwlMark — flat shapes, currentColor for
 * the body so it re-tints with whatever it sits on. Swap for the team's own
 * artwork by dropping the asset in `public/` and replacing this component's
 * internals; the sizing contract stays the same.
 *
 * The sloth hangs off the top of its box rather than sitting centred, which is
 * what makes it read as a sloth rather than a generic animal head.
 */
export default function SlothMark({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* arm curling over the branch */}
      <path
        d="M14 20c0-6 5-10 11-10h14c6 0 11 4 11 10"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* face */}
      <ellipse cx="32" cy="36" rx="17" ry="16" fill="currentColor" />

      {/* eye patches — the sloth's whole personality */}
      <ellipse cx="25" cy="34" rx="6" ry="7" className="sloth-patch" />
      <ellipse cx="39" cy="34" rx="6" ry="7" className="sloth-patch" />
      <circle cx="25" cy="34" r="2.4" className="sloth-eye" />
      <circle cx="39" cy="34" r="2.4" className="sloth-eye" />

      {/* snout */}
      <ellipse cx="32" cy="42" rx="3" ry="2.2" className="sloth-eye" />
      <path
        d="M28.5 45.5c1.6 1.6 5.4 1.6 7 0"
        className="sloth-smile"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
