"use client";

import ExpenseComposer from "@/components/ExpenseComposer";

/**
 * Add an expense — a single compose screen, replacing the four-step wizard.
 * Payments aren't created here; settle-up is the only door into that flow.
 */
export default function NewTransactionPage() {
  return <ExpenseComposer />;
}
