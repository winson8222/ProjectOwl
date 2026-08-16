"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import GroupList, { GroupTile, type PickableGroup } from "@/components/GroupList";
import { tapLight } from "@/lib/haptics";

interface GroupPickerWheelProps {
  groups: PickableGroup[];
  selectedGroupId: string;
  onGroupChange: (groupId: string) => void;
}

/**
 * Group selector: a card that opens a bottom sheet of groups.
 *
 * This replaced a hand-rolled scroll wheel whose touch handlers all lived on
 * the collapsed card — which unmounts the moment it expands, so once open
 * there was nothing listening and it couldn't be scrolled at all. Rebuilding
 * the gesture wasn't worth it: PageSlider claims horizontal drags across the
 * whole screen, so a custom drag surface inside it stays fragile, while a
 * tap-to-select list has nothing to conflict with.
 *
 * Named for its old behaviour so the call site didn't have to change.
 */
export default function GroupPickerWheel({
  groups,
  selectedGroupId,
  onGroupChange,
}: GroupPickerWheelProps) {
  const [open, setOpen] = useState(false);

  if (groups.length === 0) return null;

  const selected = groups.find((g) => g.id === selectedGroupId) ?? groups[0];

  return (
    <div className="mb-4">
      <button
        onClick={() => {
          tapLight();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="card-lift pressable w-full flex items-center gap-3 px-4 text-left"
        style={{ minHeight: 64 }}
      >
        <GroupTile group={selected} size={40} />
        <span className="flex-1 min-w-0 text-callout font-semibold text-ink truncate">
          {selected.name}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-ink-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} label="Choose a group">
        <h3 className="text-title2 font-bold text-ink mb-4">Group</h3>
        <GroupList
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelect={(id) => {
            onGroupChange(id);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </div>
  );
}
