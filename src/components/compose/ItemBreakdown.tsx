"use client";

import { useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import type { AssignmentResult } from "@/components/ItemAssigner";

interface ItemBreakdownProps {
  assignment: AssignmentResult;
  members: any[];
  currentUserId?: string;
  onEdit?: () => void;
}

/**
 * Read-only "who had what", grouped by person.
 *
 * Sits above the custom amounts after a receipt scan so the numbers are
 * checkable: a bare "$26.40" next to your name is unverifiable, but
 * "Ramen $14.00, Gyoza $6.25, Beer $6.15" is something you can argue with.
 *
 * Grouped by person rather than by item because the question being answered is
 * "why do I owe this much", not "who ordered the gyoza". Uses the receipt
 * language (mono, leader dots) established in ItemAssigner.
 */
export default function ItemBreakdown({
  assignment,
  members,
  currentUserId,
  onEdit,
}: ItemBreakdownProps) {
  // Invert assignmentsByItem (item → people) into person → items.
  const byPerson = useMemo(() => {
    const map = new Map<string, { nm: string; share: number }[]>();
    assignment.assignmentsByItem.forEach((entries, itemIndex) => {
      const item = assignment.items[itemIndex];
      if (!item) return;
      for (const { userId, shareAmount } of entries) {
        if (shareAmount <= 0) continue;
        const list = map.get(userId) ?? [];
        list.push({ nm: item.nm, share: shareAmount });
        map.set(userId, list);
      }
    });
    return map;
  }, [assignment]);

  const people = Array.from(byPerson.keys());
  if (people.length === 0) return null;

  const nameFor = (id: string) => {
    const m = members.find((x: any) => x.id === id);
    return id === currentUserId ? "You" : m?.name ?? "Someone";
  };
  const rawName = (id: string) =>
    members.find((x: any) => x.id === id)?.name ?? "?";

  return (
    <div
      className="rounded-[14px] overflow-hidden mb-4"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-hairline)",
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="text-footnote font-semibold text-ink-muted uppercase tracking-wider flex-1">
          From the receipt
        </span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="pressable text-subhead font-semibold"
            style={{ color: "var(--color-blueberry-600)", minHeight: 36 }}
          >
            Edit
          </button>
        )}
      </div>

      <div className="px-4 pb-3 space-y-3">
        {people.map((uid) => {
          const items = byPerson.get(uid)!;
          return (
            <div key={uid}>
              <div className="flex items-center gap-2 mb-1">
                <UserAvatar name={rawName(uid)} size="sm" />
                <span className="text-subhead font-semibold text-ink">
                  {nameFor(uid)}
                </span>
                <span className="leader" aria-hidden />
                <span className="text-subhead font-semibold text-ink tabular font-mono">
                  ${(assignment.totals[uid] ?? 0).toFixed(2)}
                </span>
              </div>
              <ul className="pl-8 space-y-0.5">
                {items.map((it, i) => (
                  <li key={i} className="flex items-baseline">
                    <span className="text-footnote text-ink-muted font-mono truncate">
                      {it.nm}
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="text-footnote text-ink-muted font-mono tabular">
                      ${it.share.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
