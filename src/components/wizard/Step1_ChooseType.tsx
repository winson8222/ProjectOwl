"use client";

import { ExpenseDiagram, PaymentDiagram } from "./TypeDiagrams";
import { tapLight } from "@/lib/haptics";

interface Step1_ChooseTypeProps {
  txType: "expense" | "payment";
  onTypeChange: (type: "expense" | "payment") => void;
  onNext: () => void;
}

const OPTIONS = [
  {
    type: "expense" as const,
    title: "Expense",
    detail: "One person paid — split it between everyone",
    Diagram: ExpenseDiagram,
  },
  {
    type: "payment" as const,
    title: "Payment",
    detail: "Pay someone back what you already owe",
    Diagram: PaymentDiagram,
  },
];

/**
 * Step 1: expense or payment.
 *
 * Stacked full-width rows rather than side-by-side cards — two columns forced
 * the descriptions into three cramped lines each, and a row is a bigger, more
 * thumb-reachable target.
 *
 * Both options are Blueberry. Payments used to carry a separate green identity
 * here and on /payments/new, which amounted to a second palette running beside
 * the primary one; the two are distinguished by the diagram and the wording
 * instead of by hue.
 */
export default function Step1_ChooseType({ txType, onTypeChange, onNext }: Step1_ChooseTypeProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-title2 font-bold text-ink mb-5">What are you adding?</h2>

      {OPTIONS.map(({ type, title, detail, Diagram }) => {
        const selected = txType === type;
        return (
          <button
            key={type}
            onClick={() => {
              tapLight();
              onTypeChange(type);
              setTimeout(() => onNext(), 200);
            }}
            aria-pressed={selected}
            className="pressable w-full flex items-center gap-4 p-4 rounded-[14px] text-left transition-colors"
            style={{
              background: selected
                ? "var(--color-blueberry-100)"
                : "var(--color-surface)",
              border: `1px solid ${
                selected ? "var(--color-blueberry-600)" : "var(--color-hairline)"
              }`,
              boxShadow:
                "0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)",
            }}
          >
            <span
              className="shrink-0 flex items-center justify-center rounded-[10px]"
              style={{
                width: 60,
                height: 60,
                background: "var(--color-surface-raised)",
                color: "var(--color-blueberry-600)",
              }}
            >
              <Diagram />
            </span>
            <span className="min-w-0">
              <span className="block text-headline font-semibold text-ink">
                {title}
              </span>
              <span className="block text-subhead text-ink-muted mt-0.5">
                {detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
