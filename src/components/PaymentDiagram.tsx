/**
 * One person straight across to one other — the payment visual.
 *
 * Last survivor of wizard/TypeDiagrams.tsx: the expense/scan/manual diagrams
 * went with the wizard steps that used them. Payments are told apart from
 * expenses by this shape and the wording, not by a separate colour.
 */
export function PaymentDiagram({ className }: { className?: string }) {
  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="9" cy="22" r="5" fill="currentColor" stroke="none" />
      <circle cx="35" cy="22" r="5" />
      <path d="M17 22h10" />
      <path d="M24 18.5 27.5 22 24 25.5" />
    </svg>
  );
}
