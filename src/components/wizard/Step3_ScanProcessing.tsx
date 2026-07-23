"use client";

interface Step3_ScanProcessingProps {
  scanResult: any;
  scanItems: any[];
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 3c (Expense + Scan): Review scan results
 */
export default function Step3_ScanProcessing({
  scanResult,
  scanItems,
  onNext,
  onBack
}: Step3_ScanProcessingProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        Receipt Extracted!
      </h2>

      <div
        className="rounded-2xl p-6 mb-4 backdrop-blur-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(20,184,166,0.05) 100%)',
          border: '1px solid rgba(16,185,129,0.2)'
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">✅</span>
          <span className="text-sm font-semibold text-emerald-700">
            Successfully extracted {scanItems.length} items
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Total: ${scanResult?.total?.toFixed(2) || "0.00"}
        </p>
      </div>

      {/* Items Preview */}
      <div className="rounded-xl overflow-hidden backdrop-blur-sm"
           style={{
             background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
             border: '1px solid rgba(176,176,176,0.2)',
             boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
           }}>
        <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50/80">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items Found</h3>
        </div>
        <div className="divide-y divide-[var(--border)] max-h-60 overflow-y-auto">
          {scanItems.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-900 font-medium">{item.nm || "Item"}</span>
                <span className="font-mono text-gray-700">${(item.price || 0).toFixed(2)}</span>
              </div>
              {item.cnt > 1 && (
                <span className="text-xs text-gray-400">Quantity: {item.cnt}</span>
              )}
            </div>
          ))}
          {scanItems.length > 5 && (
            <div className="px-4 py-2 text-xs text-gray-400 text-center">
              ...and {scanItems.length - 5} more items
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        You'll be able to review and edit all items in the next step
      </p>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 rounded-xl backdrop-blur-sm transition-all"
          style={{
            border: '1px solid rgba(176,176,176,0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.2) 100%)'
          }}
        >
          ← Rescan
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(58,133,197,0.9) 0%, rgba(42,107,165,0.85) 100%)',
            border: '1px solid rgba(58,133,197,0.4)',
            boxShadow: '0 2px 4px rgba(58,133,197,0.2), 0 4px 8px rgba(58,133,197,0.15)'
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
