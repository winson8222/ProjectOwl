/**
 * Nav glyphs as real SVGs.
 *
 * These replace the text characters (⌂ ⊟ + ◉) the nav used to render.
 * Those resolve to different fonts with different metrics and baselines on
 * every platform — inconsistent optical weight across tabs is one of the
 * clearest "this is a web page" tells. Drawn on a 24×24 box, stroked so
 * weight stays even at any size.
 */

type IconProps = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 10.5 12 3.75l8.5 6.75" />
      <path d="M5.75 9v10.25h12.5V9" />
    </svg>
  );
}

export function GroupsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8.5" cy="8.75" r="3.25" />
      <path d="M2.75 19.25a5.75 5.75 0 0 1 11.5 0" />
      <path d="M15.5 6.1a3.25 3.25 0 0 1 0 5.3" />
      <path d="M17.4 14.4a5.75 5.75 0 0 1 3.85 4.85" />
    </svg>
  );
}

export function AddIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5.25v13.5M5.25 12h13.5" />
    </svg>
  );
}

export function ActivityIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.75 12.25h4l2.5-6 4 12 2.75-7.25 1.75 3.25h3.5" />
    </svg>
  );
}
