"use client";

interface NetBalance {
  userId: string;
  amount: number;
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Visualizes one debt-simplification case:
 *  - diverging balance bars (who owes / who is owed)
 *  - an SVG flow diagram of the resulting settlement plan (debtors → creditors)
 */
export default function SimplifyTestViz({
  netBalances,
  transfers,
}: {
  netBalances: NetBalance[];
  transfers: Transfer[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      <BalanceBars netBalances={netBalances} />
      <FlowDiagram transfers={transfers} />
    </div>
  );
}

// ── Diverging balance bars ──────────────────────────────────────────
function BalanceBars({ netBalances }: { netBalances: NetBalance[] }) {
  if (netBalances.length === 0) {
    return (
      <div className="flex items-center justify-center text-[11px] text-gray-400 bg-white rounded-lg border border-gray-100 py-4">
        all balances zero
      </div>
    );
  }

  const maxAbs = Math.max(1, ...netBalances.map((b) => Math.abs(b.amount)));
  const sorted = [...netBalances].sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Net balances</div>
      <div className="space-y-1">
        {sorted.map((b) => {
          const pct = (Math.abs(b.amount) / maxAbs) * 50; // half-width max
          const positive = b.amount > 0;
          return (
            <div key={b.userId} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-6 font-mono text-gray-600 shrink-0">{b.userId}</span>
              {/* bar track with center line */}
              <div className="relative flex-1 h-3.5 bg-gray-50 rounded">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
                <div
                  className="absolute top-0 bottom-0 rounded"
                  style={{
                    background: positive ? "var(--success)" : "var(--danger)",
                    left: positive ? "50%" : `${50 - pct}%`,
                    width: `${pct}%`,
                  }}
                />
              </div>
              <span
                className="w-12 text-right font-mono shrink-0"
                style={{ color: positive ? "var(--success)" : "var(--danger)" }}
              >
                {positive ? "+" : "−"}${Math.abs(b.amount).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Settlement flow diagram ─────────────────────────────────────────
function FlowDiagram({ transfers }: { transfers: Transfer[] }) {
  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-[11px] text-[var(--success)] bg-white rounded-lg border border-gray-100 py-4">
        <span className="text-lg">✓</span>
        everyone is settled up
      </div>
    );
  }

  const debtors = [...new Set(transfers.map((t) => t.from))];
  const creditors = [...new Set(transfers.map((t) => t.to))];

  const rowGap = 34;
  const nodeR = 12;
  const width = 220;
  const leftX = 34;
  const rightX = width - 34;
  const rows = Math.max(debtors.length, creditors.length);
  const height = rows * rowGap + 16;

  const colY = (count: number, i: number) => {
    const totalH = count * rowGap;
    const startY = (height - totalH) / 2 + rowGap / 2;
    return startY + i * rowGap;
  };

  const debtorY = (id: string) => colY(debtors.length, debtors.indexOf(id));
  const creditorY = (id: string) => colY(creditors.length, creditors.indexOf(id));

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
        Settlement plan · {transfers.length} payment{transfers.length === 1 ? "" : "s"}
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" />
          </marker>
        </defs>

        {/* edges */}
        {transfers.map((t, i) => {
          const y1 = debtorY(t.from);
          const y2 = creditorY(t.to);
          const midX = (leftX + rightX) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line
                x1={leftX + nodeR}
                y1={y1}
                x2={rightX - nodeR - 2}
                y2={y2}
                stroke="#9ca3af"
                strokeWidth="1"
                markerEnd="url(#arrow)"
              />
              <rect x={midX - 18} y={midY - 7} width="36" height="13" rx="3" fill="white" />
              <text x={midX} y={midY + 2} textAnchor="middle" fontSize="9" fill="#4b5563" fontFamily="monospace">
                ${t.amount.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* debtor nodes (left, red) */}
        {debtors.map((id) => (
          <g key={`d-${id}`}>
            <circle cx={leftX} cy={debtorY(id)} r={nodeR} fill="var(--danger)" opacity="0.15" />
            <circle cx={leftX} cy={debtorY(id)} r={nodeR} fill="none" stroke="var(--danger)" strokeWidth="1.5" />
            <text x={leftX} y={debtorY(id) + 3} textAnchor="middle" fontSize="10" fill="var(--danger)" fontFamily="monospace" fontWeight="bold">
              {id}
            </text>
          </g>
        ))}

        {/* creditor nodes (right, green) */}
        {creditors.map((id) => (
          <g key={`c-${id}`}>
            <circle cx={rightX} cy={creditorY(id)} r={nodeR} fill="var(--success)" opacity="0.15" />
            <circle cx={rightX} cy={creditorY(id)} r={nodeR} fill="none" stroke="var(--success)" strokeWidth="1.5" />
            <text x={rightX} y={creditorY(id) + 3} textAnchor="middle" fontSize="10" fill="var(--success)" fontFamily="monospace" fontWeight="bold">
              {id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
