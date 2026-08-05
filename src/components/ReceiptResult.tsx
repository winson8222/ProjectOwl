import type { ReceiptExtractionResult } from "@/lib/schemas/receipt";

interface ReceiptResultProps {
  data: ReceiptExtractionResult;
}

/**
 * Displays the extracted receipt data: item table + totals summary.
 */
export default function ReceiptResult({ data }: ReceiptResultProps) {
  const { menu, subtotal_price, tax_price, service_price, discount_price, total_price } =
    data;

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Item table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-canvas">
          <h2 className="text-sm font-semibold text-ink">Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-muted uppercase tracking-wider border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-2 py-2 text-center w-12">Qty</th>
              <th className="px-4 py-2 text-right w-24">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {menu.map((item, idx) => (
              <tr key={idx} className="hover:bg-canvas">
                <td className="px-4 py-2.5 text-ink">{item.nm}</td>
                <td className="px-2 py-2.5 text-center text-ink-muted">
                  {item.cnt ?? 1}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-ink">
                  ${formatPrice(item.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
        <div className="flex justify-between text-sm text-ink-muted">
          <span>Subtotal</span>
          <span className="font-mono">
            {subtotal_price != null ? `$${formatPrice(subtotal_price)}` : "—"}
          </span>
        </div>
        {tax_price != null && tax_price > 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>Tax</span>
            <span className="font-mono">${formatPrice(tax_price)}</span>
          </div>
        )}
        {service_price != null && service_price > 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>Service</span>
            <span className="font-mono">${formatPrice(service_price)}</span>
          </div>
        )}
        {discount_price != null && discount_price > 0 && (
          <div className="flex justify-between text-sm text-[var(--success)]">
            <span>Discount</span>
            <span className="font-mono">-${formatPrice(discount_price)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-ink pt-1.5 border-t border-[var(--border)]">
          <span>Total</span>
          <span className="font-mono">${formatPrice(total_price)}</span>
        </div>
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}
