interface UserAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

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

  // Generate a consistent color from the name
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500",
  ];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={`${sizeMap[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
