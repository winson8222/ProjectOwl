"use client";

import ExpenseComposer from "@/components/ExpenseComposer";

/**
 * Add an expense — a single compose screen, replacing the old six-step wizard.
 * Payments are not created here; settle-up is the only door into that flow.
 */
export default function NewTransactionPage() {
  return <ExpenseComposer />;
}
