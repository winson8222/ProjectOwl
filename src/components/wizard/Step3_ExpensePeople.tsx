"use client";

import UserAvatar, { avatarTone } from "@/components/UserAvatar";
import { tapLight } from "@/lib/haptics";

interface Step3_ExpensePeopleProps {
  paidBy: string;
  setPaidBy: (id: string) => void;
  selectedParticipants: string[];
  setSelectedParticipants: (ids: string[]) => void;
  user: any;
  users: any[];
  selectedGroupId: string;
  /** Bill total, used only to preview each person's even share. */
  amount?: number;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 3 (Expense): who paid, and who it's split between.
 *
 * The two questions used to render as identical translucent panels holding
 * identical chip grids — but one is single-select and the other is
 * multi-select, and nothing on screen said so. They now take the shape of
 * what they are: a rail of avatars for the single choice, a checklist of
 * full-width rows for the multiple one.
 *
 * The character comes from live arithmetic rather than decoration. Every tap
 * re-splits the bill, and the bar underneath shows the split as a shape being
 * assembled — which is the whole point of the product.
 */
export default function Step3_ExpensePeople({
  paidBy,
  setPaidBy,
  selectedParticipants,
  setSelectedParticipants,
  user,
  users,
  selectedGroupId,
  amount = 0,
  onNext,
  onBack,
}: Step3_ExpensePeopleProps) {
  const isValid = paidBy && selectedParticipants.length > 0;
  const perHead =
    selectedParticipants.length > 0 ? amount / selectedParticipants.length : 0;
  const allSelected =
    users.length > 0 && selectedParticipants.length === users.length;

  const toggleParticipant = (id: string) => {
    tapLight();
    setSelectedParticipants(
      selectedParticipants.includes(id)
        ? selectedParticipants.filter((p) => p !== id)
        : [...selectedParticipants, id]
    );
  };

  const label = (u: any) => (u.id === user?.id ? "You" : u.name);

  return (
    <div>
      <h2 className="text-title2 font-bold text-ink mb-6">Who&apos;s involved?</h2>

      {/* ── Who paid — a single choice, so: a rail ───────────────── */}
      <p className="text-footnote font-semibold text-ink-muted uppercase tracking-wider mb-3">
        Who paid
      </p>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 mb-7">
        {users.map((u) => {
          const selected = paidBy === u.id;
          return (
            <button
              key={u.id}
              onClick={() => {
                tapLight();
                setPaidBy(u.id);
              }}
              aria-pressed={selected}
              className="pressable shrink-0 flex flex-col items-center gap-1.5 pt-1"
              style={{ minWidth: 72, opacity: selected || !paidBy ? 1 : 0.45 }}
            >
              <span
                className="rounded-full p-[3px] transition-all"
                style={{
                  background: selected
                    ? "var(--color-blueberry-600)"
                    : "transparent",
                }}
              >
                <span className="block rounded-full p-[2px] bg-canvas">
                  <UserAvatar name={u.name} size="lg" />
                </span>
              </span>
              <span
                className="text-footnote text-center truncate max-w-[72px]"
                style={{
                  color: selected
                    ? "var(--color-blueberry-600)"
                    : "var(--color-ink-muted)",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {label(u)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Split between — multiple choice, so: a checklist ─────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-footnote font-semibold text-ink-muted uppercase tracking-wider">
          Split between
        </p>
        <button
          onClick={() => {
            tapLight();
            setSelectedParticipants(allSelected ? [] : users.map((u) => u.id));
          }}
          className="pressable text-subhead font-semibold"
          style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
        >
          {allSelected ? "Clear all" : "Everyone"}
        </button>
      </div>

      <div className="space-y-2">
        {users.map((u) => {
          const selected = selectedParticipants.includes(u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggleParticipant(u.id)}
              aria-pressed={selected}
              className="pressable w-full flex items-center gap-3 px-3.5 rounded-[14px] text-left transition-colors"
              style={{
                minHeight: 60,
                background: selected
                  ? "var(--color-blueberry-100)"
                  : "var(--color-surface)",
                border: `1px solid ${
                  selected ? "var(--color-blueberry-600)" : "var(--color-hairline)"
                }`,
              }}
            >
              <UserAvatar name={u.name} size="md" />
              <span className="flex-1 min-w-0 text-callout font-medium text-ink truncate">
                {label(u)}
              </span>
              <span
                className="text-callout font-semibold tabular"
                style={{
                  color: selected
                    ? "var(--color-blueberry-600)"
                    : "var(--color-ink-muted)",
                }}
              >
                {selected && amount > 0 ? `$${perHead.toFixed(2)}` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── The split, as a shape ────────────────────────────────── */}
      {selectedParticipants.length > 0 && amount > 0 && (
        <div className="mt-5">
          <div
            className="flex h-2.5 rounded-full overflow-hidden gap-[2px]"
            aria-hidden
          >
            {selectedParticipants.map((id) => {
              const u = users.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="flex-1 transition-all"
                  style={{ background: u ? avatarTone(u.name) : "transparent" }}
                />
              );
            })}
          </div>
          {/* Named as a preview: the even/custom choice is the next step, so
              stating a firm per-head figure here would be a promise we might
              not keep. */}
          <p className="text-footnote text-ink-muted mt-2">
            ${amount.toFixed(2)} across {selectedParticipants.length}{" "}
            {selectedParticipants.length === 1 ? "person" : "people"} —
            you&apos;ll choose how to divide it next
          </p>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────── */}
      <div className="flex gap-3 pt-7">
        <button
          onClick={onBack}
          className="pressable px-5 rounded-[12px] text-body font-medium text-ink"
          style={{
            minHeight: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="pressable flex-1 rounded-[12px] text-body font-semibold text-white disabled:opacity-40"
          style={{
            minHeight: 50,
            background: "var(--color-blueberry-600)",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
