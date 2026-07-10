"use client";

import { useState, useEffect } from "react";
import SimplifyTestViz from "@/components/SimplifyTestViz";

/**
 * Debug page — view database contents in the browser.
 */
export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<any>(null);
  const [testsLoading, setTestsLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/debug")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const runSimplifyTests = () => {
    setTestsLoading(true);
    fetch("/api/debug/simplify-tests")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTests(json.data);
      })
      .catch(console.error)
      .finally(() => setTestsLoading(false));
  };

  useEffect(() => {
    fetchData();
    runSimplifyTests();
  }, []);

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL transactions?")) return;
    await fetch("/api/debug?action=delete-all-transactions", { method: "POST" });
    fetchData();
  };

  const handleReset = async () => {
    if (!confirm("Reset entire database?")) return;
    await fetch("/api/debug?action=reset", { method: "POST" });
    fetchData();
  };

  return (
    <main className="min-h-dvh p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">🔧 Debug</h1>
        <div className="flex gap-2">
          <button onClick={fetchData} className="px-3 py-1 text-xs bg-gray-100 rounded-lg">Refresh</button>
          <button onClick={handleDeleteAll} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg">Delete all transactions</button>
          <button onClick={handleReset} className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg">Full reset</button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}

      {data && (
        <div className="space-y-6">
          {/* Counts */}
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {Object.entries(data.counts).map(([key, val]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-2">
                <div className="font-bold text-base">{val as number}</div>
                <div className="text-gray-500">{key}</div>
              </div>
            ))}
          </div>

          {/* Users */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Users</h2>
            <div className="space-y-1">
              {data.users.map((u: any) => (
                <div key={u.id} className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                  {u.id}: {u.name}
                </div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Transactions (sorted by createdAt DESC)</h2>
            <div className="space-y-1">
              {data.transactions.map((tx: any) => {
                const participantInfo = data.participantsPerTx?.find((p: any) => p.txId === tx.id);
                return (
                  <div key={tx.id} className="text-xs font-mono bg-gray-50 px-2 py-1.5 rounded border border-gray-100">
                    <div className="flex justify-between">
                      <span className="font-bold">{tx.title}</span>
                      <span>${tx.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-gray-500 flex justify-between mt-0.5">
                      <span>Paid by: {tx.paidByUserId} · Participants: {participantInfo?.participantCount ?? "?"}</span>
                      <span className="text-[10px]">{tx.createdAt}</span>
                    </div>
                  </div>
                );
              })}
              {data.transactions.length === 0 && <p className="text-xs text-gray-400 italic">No transactions</p>}
            </div>
          </div>
        </div>
      )}

      {/* Debt-simplification test suite */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">🧮 Debt-simplification tests</h2>
            <p className="text-[11px] text-gray-400">
              Runs 10 in-memory scenarios through the minimal-transfer algorithm. No data is touched.
            </p>
          </div>
          <button
            onClick={runSimplifyTests}
            disabled={testsLoading}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg disabled:opacity-50"
          >
            {testsLoading ? "Running..." : "Run tests"}
          </button>
        </div>

        {tests && (
          <div className="space-y-2">
            {/* Summary banner */}
            <div
              className={`text-sm font-semibold px-3 py-2 rounded-lg ${
                tests.failed === 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {tests.passed}/{tests.total} passed
              {tests.failed > 0 && ` · ${tests.failed} failed`}
            </div>

            {/* Per-case cards */}
            {tests.cases.map((c: any) => (
              <div
                key={c.name}
                className={`text-xs rounded-lg border px-3 py-2 ${
                  c.passed ? "border-gray-100 bg-gray-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    <span className={c.passed ? "text-green-600" : "text-red-600"}>
                      {c.passed ? "PASS" : "FAIL"}
                    </span>{" "}
                    {c.name}
                  </span>
                  <span className="text-gray-400">
                    {c.transferCount} transfer{c.transferCount === 1 ? "" : "s"}
                    {c.expectedTransfers !== undefined && ` / ${c.expectedTransfers} expected`}
                  </span>
                </div>
                <p className="text-gray-500 mt-0.5">{c.description}</p>

                {/* Visualization: balance bars + settlement flow */}
                <SimplifyTestViz netBalances={c.netBalances} transfers={c.transfers} />

                {/* Failed checks */}
                {c.checks
                  .filter((ck: any) => !ck.passed)
                  .map((ck: any, i: number) => (
                    <div key={i} className="mt-1 text-red-600">
                      ✗ {ck.name}
                      {ck.detail ? ` — ${ck.detail}` : ""}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
