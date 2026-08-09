"use client";

import { useState, useCallback } from "react";
import UserAvatar, { avatarTone } from "./UserAvatar";
import CalculatorKeypad from "./CalculatorKeypad";
import { tapLight } from "@/lib/haptics";

interface Participant {
  id: string;
  name: string;
}

interface SplitInputProps {
  participants: Participant[];
  totalAmount: number;
  values: Record<string, number>; // userId → amount
  onChange: (values: Record<string, number>) => void;
  mode: "even" | "custom";
  onModeChange: (mode: "even" | "custom") => void;
}

/**
 * Split method input: "Even" or "Custom".
 *
 * The split bar carries more weight here than on the people step, because in
 * custom mode it's proportional to the actual amounts — so an uneven split is
 * visible as an uneven bar before you read a single number. That's the one
 * thing a column of input fields can't tell you at a glance.
 */
export default function SplitInput({
  participants,
  totalAmount,
  values,
  onChange,
  mode,
  onModeChange,
}: SplitInputProps) {
  const [splitType, setSplitType] = useState<"amount" | "percent">("amount");
  const [percentValues, setPercentValues] = useState<Record<string, number>>({});
  const [keypadUserId, setKeypadUserId] = useState<string | null>(null);

  const splitEven = useCallback(() => {
    const evenAmount = Math.round((totalAmount / participants.length) * 100) / 100;
    const remainder = Math.round((totalAmount - evenAmount * participants.length) * 100) / 100;
    const newValues: Record<string, number> = {};
    participants.forEach((p, i) => {
      newValues[p.id] = i === participants.length - 1
        ? Math.round((evenAmount + remainder) * 100) / 100 // last person gets the rounding
        : evenAmount;
    });
    onChange(newValues);

    // Set percentages too
    const evenPct = Math.round(100 / participants.length);
    const pctRemainder = 100 - evenPct * participants.length;
    const newPcts: Record<string, number> = {};
    participants.forEach((p, i) => {
      newPcts[p.id] = i === participants.length - 1 ? evenPct + pctRemainder : evenPct;
    });
    setPercentValues(newPcts);
  }, [totalAmount, participants, onChange]);

  const updateAmount = useCallback((userId: string, amount: number) => {
    const newValues = { ...values };
    newValues[userId] = Math.max(0, amount);
    onChange(newValues);

    // Auto-update percentage
    const pct = totalAmount > 0 ? (newValues[userId] / totalAmount) * 100 : 0;
    setPercentValues((prev) => ({ ...prev, [userId]: Math.round(pct * 100) / 100 }));
  }, [values, totalAmount, onChange]);

  const updatePercent = useCallback((userId: string, pct: number) => {
    const clampedPct = Math.max(0, Math.min(100, pct));
    setPercentValues((prev) => ({ ...prev, [userId]: clampedPct }));
    const amount = Math.round((totalAmount * clampedPct / 100) * 100) / 100;
    const newValues = { ...values };
    newValues[userId] = amount;
    onChange(newValues);
  }, [totalAmount, values, onChange]);

  const totalAllocated = Object.values(values).reduce((sum, v) => sum + v, 0);
  const remaining = Math.round((totalAmount - totalAllocated) * 100) / 100;
  const isBalanced = Math.abs(remaining) < 0.01;
  const perHead = participants.length > 0 ? totalAmount / participants.length : 0;

  /** Proportional in custom mode, equal in even mode. */
  const barWeight = (id: string) =>
    mode === "custom" && totalAllocated > 0
      ? (values[id] ?? 0) / totalAllocated
      : 1 / Math.max(1, participants.length);

  return (
    <>
      <div>
        {/* ── Even / Custom, as a proper segmented control ────────── */}
        <div
          className="flex p-1 rounded-[12px] mb-5"
          style={{
            background: "var(--color-canvas)",
            border: "1px solid var(--color-hairline)",
          }}
          role="tablist"
        >
          {(["even", "custom"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                tapLight();
                onModeChange(m);
                splitEven();
              }}
              className="flex-1 rounded-[9px] text-callout font-semibold transition-all"
              style={{
                minHeight: 40,
                background: mode === m ? "var(--color-surface-raised)" : "transparent",
                color: mode === m ? "var(--color-blueberry-600)" : "var(--color-ink-muted)",
                boxShadow:
                  mode === m
                    ? "0 1px 3px color-mix(in srgb, var(--color-blueberry-900) 12%, transparent)"
                    : "none",
              }}
            >
              {m === "even" ? "Split evenly" : "Custom amounts"}
            </button>
          ))}
        </div>

        {/* ── Even: state the number once, large ──────────────────── */}
        {mode === "even" && (
          <div
            className="rounded-[14px] px-4 py-5 text-center"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            <p
              className="text-display font-bold tabular"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-blueberry-600)",
              }}
            >
              ${perHead.toFixed(2)}
            </p>
            <p className="text-subhead text-ink-muted mt-1">
              each, between {participants.length}{" "}
              {participants.length === 1 ? "person" : "people"}
            </p>
          </div>
        )}

        {/* ── Custom: per-person rows ─────────────────────────────── */}
        {mode === "custom" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-footnote font-semibold text-ink-muted uppercase tracking-wider">
                Who owes what
              </p>
              <div
                className="flex p-0.5 rounded-full"
                style={{ background: "var(--color-canvas)" }}
              >
                {(["amount", "percent"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      tapLight();
                      setSplitType(t);
                    }}
                    aria-pressed={splitType === t}
                    className="rounded-full text-subhead font-semibold transition-all"
                    style={{
                      minWidth: 44,
                      minHeight: 32,
                      background:
                        splitType === t ? "var(--color-blueberry-600)" : "transparent",
                      color: splitType === t ? "white" : "var(--color-ink-muted)",
                    }}
                  >
                    {t === "amount" ? "$" : "%"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3.5 rounded-[14px]"
                  style={{
                    minHeight: 60,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-hairline)",
                  }}
                >
                  <UserAvatar name={p.name} size="md" />
                  <span className="flex-1 min-w-0 text-callout font-medium text-ink truncate">
                    {p.name}
                  </span>
                  {/* Tapping opens the calculator keypad — the field is
                      read-only so the OS keyboard never covers the row. */}
                  <button
                    onClick={() => {
                      tapLight();
                      setKeypadUserId(p.id);
                    }}
                    aria-label={`Set ${p.name}'s share`}
                    className="pressable flex items-center justify-end gap-0.5 px-3 rounded-[10px] tabular"
                    style={{
                      minHeight: 44,
                      minWidth: 92,
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  >
                    {splitType === "amount" && (
                      <span className="text-subhead text-ink-muted">$</span>
                    )}
                    <span className="text-body font-semibold text-ink">
                      {splitType === "amount"
                        ? (values[p.id] ?? 0).toFixed(2)
                        : (percentValues[p.id] ?? 0).toFixed(0)}
                    </span>
                    {splitType === "percent" && (
                      <span className="text-subhead text-ink-muted">%</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── The split, as a shape. Proportional in custom mode. ─── */}
        {participants.length > 0 && totalAmount > 0 && (
          <div className="mt-4">
            <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]" aria-hidden>
              {participants.map((p) => (
                <span
                  key={p.id}
                  style={{
                    flexGrow: Math.max(0.0001, barWeight(p.id)),
                    background: avatarTone(p.name),
                    transition: "flex-grow 220ms ease-out",
                  }}
                />
              ))}
            </div>

            {mode === "custom" && (
              <p
                className="text-footnote font-medium mt-2"
                style={{
                  color: isBalanced
                    ? "var(--color-positive)"
                    : remaining < 0
                    ? "var(--color-negative)"
                    : "var(--color-warning)",
                }}
              >
                {isBalanced
                  ? `All $${totalAmount.toFixed(2)} accounted for`
                  : remaining > 0
                  ? `$${remaining.toFixed(2)} left to assign`
                  : `$${Math.abs(remaining).toFixed(2)} over the total`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Calculator Keypad */}
      {keypadUserId && (
        <CalculatorKeypad
          open={keypadUserId !== null}
          initialValue={splitType === "amount" ? values[keypadUserId] ?? 0 : (percentValues[keypadUserId] ?? 0)}
          onConfirm={(value) => {
            if (splitType === "amount") {
              updateAmount(keypadUserId, value);
            } else {
              updatePercent(keypadUserId, value);
            }
            setKeypadUserId(null);
          }}
          title={`${participants.find((p) => p.id === keypadUserId)?.name ?? "Participant"}'s share`}
        />
      )}
    </>
  );
}
