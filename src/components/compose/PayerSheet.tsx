"use client";

import { useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import Portal from "@/components/Portal";
import { tapLight } from "@/lib/haptics";

export type PayerMode = "single" | "split";

interface PayerSheetProps {
  members: any[];
  currentUserId?: string;
  /** Bill total — payer contributions have to add up to it. */
  amount: number;

  /** userId → amount contributed. One entry = the ordinary single-payer case. */
  payers: Record<string, number>;
  onPayersChange: (payers: Record<string, number>) => void;

  mode: PayerMode;
  onModeChange: (mode: PayerMode) => void;

  /** Opens the keypad for one payer's contribution. */
  onEditAmount: (userId: string) => void;
  onClose: () => void;
}

/**
 * Who put money in.
 *
 * Two modes, mirroring SplitSheet so the two halves of "who paid / who owes"
 * behave the same way:
 *
 *   single — one person covered it. Tapping a name commits and closes, because
 *            a single choice has nothing to confirm.
 *   split  — several cards. Select contributors, then set what each put in;
 *            the amounts must reconcile to the total before Done enables.
 *
 * A full-screen overlay portalled to body: /transactions/new lives inside
 * PageSlider, whose animated transform would otherwise capture fixed
 * positioning and trap this below the app header.
 */
export default function PayerSheet({
  members,
  currentUserId,
  amount,
  payers,
  onPayersChange,
  mode,
  onModeChange,
  onEditAmount,
  onClose,
}: PayerSheetProps) {
  const selected = useMemo(() => Object.keys(payers), [payers]);
  const contributed = useMemo(
    () => selected.reduce((s, id) => s + (payers[id] ?? 0), 0),
    [selected, payers]
  );
  const remaining = Math.round((amount - contributed) * 100) / 100;
  const balanced = Math.abs(remaining) < 0.01;

  const canDone =
    selected.length > 0 && (mode === "single" || balanced || amount <= 0);

  const nameFor = (m: any) => (m.id === currentUserId ? "You" : m.name);

  /** Even contributions across whoever is selected, remainder on the last. */
  const evenly = (ids: string[]) => {
    if (ids.length === 0) return {};
    const each = Math.round((amount / ids.length) * 100) / 100;
    const out: Record<string, number> = {};
    ids.forEach((id) => (out[id] = each));
    const diff = Math.round((amount - each * ids.length) * 100) / 100;
    if (Math.abs(diff) > 0.001) {
      const last = ids[ids.length - 1];
      out[last] = Math.round((out[last] + diff) * 100) / 100;
    }
    return out;
  };

  const toggle = (id: string) => {
    tapLight();
    if (mode === "single") {
      onPayersChange({ [id]: amount });
      onClose();
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onPayersChange(evenly(next));
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex flex-col md:max-w-lg md:mx-auto"
        style={{ background: "var(--color-canvas)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Who paid"
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div
          className="px-4 pb-3 shrink-0"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onClose}
              className="pressable text-subhead font-medium -m-2 p-2"
              style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
            >
              Cancel
            </button>
            <h2 className="text-headline font-semibold text-ink flex-1 text-center">
              Paid by
            </h2>
            <button
              onClick={onClose}
              disabled={!canDone}
              className="pressable text-subhead font-semibold -m-2 p-2 disabled:opacity-40"
              style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
            >
              Done
            </button>
          </div>

          <div
            className="flex p-1 rounded-[12px]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
            role="tablist"
          >
            {(["single", "split"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  tapLight();
                  onModeChange(m);
                  // Moving to split seeds an even share across whoever is
                  // already chosen; moving back collapses to one payer.
                  if (m === "split") {
                    onPayersChange(evenly(selected.length ? selected : []));
                  } else if (selected.length > 0) {
                    onPayersChange({ [selected[0]]: amount });
                  }
                }}
                className="flex-1 rounded-[9px] text-callout font-semibold transition-all"
                style={{
                  minHeight: 40,
                  background:
                    mode === m ? "var(--color-surface-raised)" : "transparent",
                  color:
                    mode === m
                      ? "var(--color-blueberry-600)"
                      : "var(--color-ink-muted)",
                  boxShadow:
                    mode === m
                      ? "0 1px 3px color-mix(in srgb, var(--color-blueberry-900) 12%, transparent)"
                      : "none",
                }}
              >
                {m === "single" ? "One person" : "Multiple people"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Members ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {mode === "split" && (
            <p className="text-footnote text-ink-muted mb-3">
              Select everyone who put money in, then set what each paid.
            </p>
          )}

          <div className="space-y-2">
            {members.map((m: any) => {
              const on = selected.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3.5 rounded-[14px] transition-colors"
                  style={{
                    minHeight: 60,
                    background: on
                      ? "var(--color-blueberry-100)"
                      : "var(--color-surface)",
                    border: `1px solid ${
                      on ? "var(--color-blueberry-600)" : "var(--color-hairline)"
                    }`,
                  }}
                >
                  <button
                    onClick={() => toggle(m.id)}
                    aria-pressed={on}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    style={{ minHeight: 56 }}
                  >
                    {mode === "split" && (
                      <span
                        className="shrink-0 rounded-[7px] flex items-center justify-center"
                        style={{
                          width: 24,
                          height: 24,
                          background: on
                            ? "var(--color-blueberry-600)"
                            : "transparent",
                          border: on
                            ? "none"
                            : "2px solid var(--color-blueberry-300)",
                        }}
                      >
                        {on && (
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M5 12.5l5 5 9-10" />
                          </svg>
                        )}
                      </span>
                    )}
                    <UserAvatar name={m.name} size="md" />
                    <span className="flex-1 min-w-0 text-callout font-medium text-ink truncate">
                      {nameFor(m)}
                    </span>
                  </button>

                  {mode === "split" && on && (
                    <button
                      onClick={() => {
                        tapLight();
                        onEditAmount(m.id);
                      }}
                      aria-label={`Set what ${m.name} paid`}
                      className="pressable shrink-0 px-3 rounded-[10px] text-callout font-semibold text-ink tabular"
                      style={{
                        minHeight: 44,
                        minWidth: 84,
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-hairline)",
                      }}
                    >
                      ${(payers[m.id] ?? 0).toFixed(2)}
                    </button>
                  )}

                  {mode === "single" && on && (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-blueberry-600)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                      aria-hidden
                    >
                      <path d="M5 12.5l5 5 9-10" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {mode === "split" && amount > 0 && selected.length > 0 && (
            <p
              className="text-footnote font-medium mt-3"
              style={{
                color: balanced
                  ? "var(--color-positive)"
                  : remaining < 0
                  ? "var(--color-negative)"
                  : "var(--color-warning)",
              }}
            >
              {balanced
                ? `All $${amount.toFixed(2)} accounted for`
                : remaining > 0
                ? `$${remaining.toFixed(2)} of the bill still unpaid`
                : `$${Math.abs(remaining).toFixed(2)} more than the bill`}
            </p>
          )}
        </div>
      </div>
    </Portal>
  );
}
