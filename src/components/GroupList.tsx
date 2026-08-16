"use client";

import { tapLight } from "@/lib/haptics";

export interface PickableGroup {
  id: string;
  name: string;
  color?: string;
}

/**
 * The group's colour tile.
 *
 * A rounded square, deliberately not a circle — circles are people in this
 * app, and a group sitting next to member avatars shouldn't read as one more
 * of them.
 */
export function GroupTile({
  group,
  size = 36,
}: {
  group: PickableGroup;
  size?: number;
}) {
  return (
    <span
      className="shrink-0 grid place-items-center text-white font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        fontSize: size * 0.42,
        background: group.color || "var(--color-blueberry-600)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
      }}
      aria-hidden
    >
      {group.name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Selectable list of groups, for use inside a sheet.
 *
 * Just the rows — the sheet, its heading and its dismissal belong to the
 * caller, because the three places that need this want different framing:
 * the home picker opens straight onto it, the compose screen opens it from a
 * field, and the scan confirmation swaps it in over its own contents.
 *
 * Extracted when the third caller appeared. The first two had drifted into
 * near-identical copies already.
 */
export default function GroupList({
  groups,
  selectedGroupId,
  onSelect,
}: {
  groups: PickableGroup[];
  selectedGroupId: string;
  onSelect: (groupId: string) => void;
}) {
  return (
    <div className="space-y-2 pb-2">
      {groups.map((group) => {
        const isSelected = group.id === selectedGroupId;
        return (
          <button
            key={group.id}
            onClick={() => {
              tapLight();
              onSelect(group.id);
            }}
            aria-pressed={isSelected}
            className="pressable w-full flex items-center gap-3 px-3.5 rounded-[14px] text-left transition-colors"
            style={{
              minHeight: 60,
              background: isSelected
                ? "var(--color-blueberry-100)"
                : "var(--color-surface)",
              border: `1px solid ${
                isSelected
                  ? "var(--color-blueberry-600)"
                  : "var(--color-hairline)"
              }`,
            }}
          >
            <GroupTile group={group} />
            <span className="flex-1 min-w-0 text-callout font-medium text-ink truncate">
              {group.name}
            </span>
            {isSelected && (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-blueberry-600)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12.5l5 5 9-10" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
