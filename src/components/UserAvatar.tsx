interface UserAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-7 h-7 text-caption",
  md: "w-9 h-9 text-footnote",
  lg: "w-12 h-12 text-callout",
};

/** Token-derived avatar tones, muted to sit on cream. Exported because the
 *  split bar and the assigner's tally strip color by person, so callers need
 *  the same hash → color mapping. */
export const AVATAR_TONES = [
  "var(--color-avatar-1)",
  "var(--color-avatar-2)",
  "var(--color-avatar-3)",
  "var(--color-avatar-4)",
  "var(--color-avatar-5)",
  "var(--color-avatar-6)",
  "var(--color-avatar-7)",
  "var(--color-avatar-8)",
];

/** Stable per-name tone. Same hash the component uses. */
export function avatarTone(name: string): string {
  const i =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATAR_TONES.length;
  return AVATAR_TONES[i];
}

/**
 * Avatar circle with initials fallback (no image loading needed).
 */
export default function UserAvatar({ name, size = "md", className = "" }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeMap[size]} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ background: avatarTone(name) }}
      title={name}
    >
      {initials}
    </div>
  );
}
