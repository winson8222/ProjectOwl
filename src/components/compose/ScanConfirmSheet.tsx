"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import SlothMark from "@/components/SlothMark";
import GroupList, { GroupTile } from "@/components/GroupList";
import { tapLight } from "@/lib/haptics";

interface Group {
  id: string;
  name: string;
  color?: string;
}

interface ScanConfirmSheetProps {
  open: boolean;
  groups: Group[];
  selectedGroupId: string;
  onGroupChange: (groupId: string) => void;
  /** User confirmed — go and scan. */
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * A beat before the camera opens: which group is this receipt for?
 *
 * The expense is only visible to one group and moves only that group's
 * balances, and a scan is the one path where several minutes of work
 * (photograph, assign every item between people) happens before anyone sees
 * the group name again. Getting it wrong means redoing all of it, so the
 * confirmation is cheap relative to the mistake.
 *
 * The group is changeable in place rather than behind a second sheet: the
 * whole point is to catch a wrong one, so making the fix a detour would defeat
 * it. Tapping the name swaps this sheet's contents for the list and back
 * again — one surface, two modes, no nested overlays to dismiss in order.
 */
export default function ScanConfirmSheet({
  open,
  groups,
  selectedGroupId,
  onGroupChange,
  onConfirm,
  onClose,
}: ScanConfirmSheetProps) {
  const [choosing, setChoosing] = useState(false);

  // Always reopen on the confirmation, never on a list the user left behind.
  useEffect(() => {
    if (open) setChoosing(false);
  }, [open]);

  const selected = groups.find((g) => g.id === selectedGroupId) ?? groups[0];


  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={choosing ? "Choose a group" : "Confirm the group"}
    >
      {choosing ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setChoosing(false)}
              className="pressable text-subhead font-semibold -ml-2 px-2"
              style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
            >
              Back
            </button>
            <h3 className="text-title2 font-bold text-ink">Group</h3>
          </div>

          <GroupList
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelect={(id) => {
              onGroupChange(id);
              setChoosing(false);
            }}
          />
        </>
      ) : (
        <>
          <div className="flex flex-col items-center text-center pt-1">
            <span
              className="flex items-center justify-center rounded-full mb-3"
              style={{
                width: 76,
                height: 76,
                background: "var(--color-blueberry-100)",
                color: "var(--color-blueberry-600)",
              }}
            >
              <SlothMark size={52} />
            </span>

            <p className="text-body text-ink-muted">This receipt is for</p>

            {/* The group name IS the control — it's the thing being checked,
                so it's also the thing you tap to change. */}
            <button
              onClick={() => {
                tapLight();
                setChoosing(true);
              }}
              className="pressable inline-flex items-center gap-2 mt-1.5 px-3 rounded-[12px]"
              style={{
                minHeight: 48,
                background: "var(--color-blueberry-100)",
                border: "1px solid var(--color-blueberry-300)",
              }}
              aria-label={`Group: ${selected?.name ?? "none"}. Tap to change.`}
            >
              {selected && <GroupTile group={selected} size={28} />}
              <span
                className="text-title2 font-bold"
                style={{ color: "var(--color-blueberry-600)" }}
              >
                {selected?.name ?? "No group"}
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-blueberry-600)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* States the cost of getting it wrong, not just the fact of the
                choice. Changing groupId clears participants, scanned items and
                the item assignment (see ExpenseComposer) — so after a scan
                this really is destructive, and saying so here is the only
                warning the user gets before the work exists. */}
            <p className="text-footnote text-ink-muted mt-3 mb-5 max-w-[19rem]">
              Check this now — once you&apos;ve scanned and split the items,
              changing the group clears the receipt and you&apos;ll have to scan
              and assign it all over again.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={onConfirm}
              disabled={!selected}
              className="pressable-cta w-full rounded-[12px] text-body font-semibold text-white disabled:opacity-40"
              style={{ minHeight: 50, background: "var(--color-blueberry-600)" }}
            >
              Scan receipt
            </button>
            <button
              onClick={onClose}
              className="pressable-cta w-full rounded-[12px] text-body font-medium text-ink"
              style={{
                minHeight: 50,
                background: "var(--color-surface)",
                border: "1px solid var(--color-hairline)",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
