"use client";

import { convertLineMode, lineAmount, type AdjustmentLine } from "@/lib/adjustments";
import { tapLight } from "@/lib/haptics";

interface AdjustmentRowProps {
  label: string;
  line: AdjustmentLine;
  onChange: (next: AdjustmentLine) => void;
  /** Base for percentages — the items' subtotal. */
  itemsSum: number;
  /** Discounts read as money off, so they're shown negative and in green. */
  negative?: boolean;
  onRemove: () => void;
  /** Open the calculator keypad for this line's value. */
  onEdit: () => void;
}

/**
 * One editable non-item line (tax / discount / other), shaped like a line on
 * the receipt it's describing: label, what you typed, then what it comes to.
 *
 * Inline rather than behind a sheet — on a receipt these numbers sit right
 * under the items, and a tax you can't see while assigning is a tax you
 * forget is wrong. The unit is a single toggle rather than a two-option
 * segmented control: there are only two units, so a control that shows the
 * current one and swaps on tap says the same thing in half the width.
 */
export default function AdjustmentRow({
  label,
  line,
  onChange,
  itemsSum,
  negative = false,
  onRemove,
  onEdit,
}: AdjustmentRowProps) {
  const amount = lineAmount(line, itemsSum);
  const signed = negative ? -amount : amount;
  const isPercent = line.mode === "percent";

  return (
    <div className="flex items-center gap-2" style={{ minHeight: 40 }}>
      <span className="text-subhead text-ink shrink-0">{label}</span>

      <span className="leader" aria-hidden />

      {/* Earns its place when it says something the input doesn't: what a
          percentage comes to, or that a discount comes off. */}
      {(isPercent || negative) && (
        <span
          className="text-subhead font-mono tabular shrink-0"
          style={{
            color: negative ? "var(--color-positive)" : "var(--color-ink)",
          }}
        >
          {signed < 0 ? "−" : "+"}${Math.abs(signed).toFixed(2)}
        </span>
      )}

      {/* What you typed, with its unit attached — bordered so it reads as
          the editable thing on the row rather than more receipt text. */}
      <div
        className="flex items-center rounded-lg overflow-hidden shrink-0"
        style={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-hairline)",
        }}
      >
        {/* Tapping opens the calculator rather than the OS keyboard — the
            same contract as every other number on this screen, and it can
            take "12.50+3" without leaving the row. */}
        <button
          onClick={() => {
            tapLight();
            onEdit();
          }}
          aria-label={`${label}: ${line.value}${isPercent ? "%" : ""} — tap to change`}
          className="pressable px-2.5 text-subhead text-right font-mono tabular text-ink rounded-l-lg"
          style={{ minWidth: 84, minHeight: 36 }}
        >
          {line.value ? line.value.toFixed(2) : "0"}
        </button>
        <button
          onClick={() => {
            tapLight();
            onChange(convertLineMode(line, itemsSum, isPercent ? "amount" : "percent"));
          }}
          aria-label={`${label} is ${isPercent ? "a percentage" : "an amount"} — tap to switch`}
          className="pressable text-subhead font-semibold shrink-0"
          style={{
            width: 34,
            minHeight: 36,
            background: "var(--color-blueberry-600)",
            color: "white",
          }}
        >
          {isPercent ? "%" : "$"}
        </button>
      </div>

      <button
        onClick={() => {
          tapLight();
          onRemove();
        }}
        aria-label={`Remove ${label}`}
        className="pressable shrink-0 flex items-center justify-center text-ink-muted"
        style={{ width: 28, minHeight: 32 }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
