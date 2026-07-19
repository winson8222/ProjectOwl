"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserPicker from "@/components/UserPicker";
import SplitInput from "@/components/SplitInput";
import ItemAssigner from "@/components/ItemAssigner";
import ReceiptUploader from "@/components/ReceiptUploader";
import LoadingOverlay from "@/components/LoadingOverlay";
import ErrorAlert from "@/components/ErrorAlert";
import ErrorDialog from "@/components/ErrorDialog";
import FormField from "@/components/FormField";
import UserAvatar from "@/components/UserAvatar";
import { getSessionUser } from "@/lib/session";
import { ERROR_MESSAGES, mapErrorMessage } from "@/lib/constants";
import { DEBUG_UI, MOCK_SCAN_ENABLED } from "@/lib/debug-config";
import { MOCK_RECEIPTS } from "@/lib/test-data/allocation-fixtures";
import type { AssignmentResult } from "@/components/ItemAssigner";
import type { ReceiptExtractionResult, ExtractApiResponse } from "@/lib/schemas/receipt";

type ScanStatus = "idle" | "choosing" | "uploading" | "extracted" | "error";

/**
 * Unified create transaction page.
 *
 * Default state: manual entry form (description, total, date, participants, split).
 * Optional: tap "Scan receipt" → upload → extract → assign items to participants →
 *           confirm → prefills split amounts → save.
 *
 * Scanned items and their assignments are saved alongside the transaction,
 * and remain viewable on the detail page even if the final split amounts are edited.
 */
export default function NewTransactionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [participantsMeta, setParticipantsMeta] = useState<{ id: string; name: string }[]>([]);

  // ── Group (transactions always happen within a group) ─────────────
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // ── Base form fields ───────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState("");
  const [splitMode, setSplitMode] = useState<"even" | "custom">("even");
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);

  // ── Scan state ─────────────────────────────────────────────────────
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanResult, setScanResult] = useState<ReceiptExtractionResult | null>(null);
  const [scanItems, setScanItems] = useState<{ nm: string; price: number; cnt?: number }[]>([]);
  const [showAssigner, setShowAssigner] = useState(false);
  // Debug: use mock receipts instead of the real LLM scan API.
  const [mockScan, setMockScan] = useState(MOCK_SCAN_ENABLED);

  // ── Item assignment state ──────────────────────────────────────────
  // Scanned items with their per-user assignments, saved alongside the transaction
  const [savedAssignments, setSavedAssignments] = useState<
    { userId: string; shareAmount: number }[][] | null
  >(null);
  // The per-person totals produced by the last allocation — kept as the
  // read-only reference the user can re-apply to the custom split.
  const [allocationTotals, setAllocationTotals] = useState<Record<string, number> | null>(null);
  // Raw per-unit assignment snapshot, so re-opening the assigner restores it.
  const [unitState, setUnitState] = useState<Record<string, string[]> | undefined>(undefined);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) return;
    setUser(currentUser);
    setPaidBy(currentUser.id);
    setSelectedParticipants([currentUser.id]);

    // Deep-link support: /transactions/new?groupId=xxx (from a group page)
    const requestedGroupId = new URLSearchParams(window.location.search).get("groupId");

    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          const match = json.data.find((g: any) => g.id === requestedGroupId);
          setSelectedGroupId(match?.id ?? json.data[0]?.id ?? "");
        } else {
          setError(json.error || "Failed to load groups");
        }
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setGroupsLoaded(true));
  }, []);

  // Participants come from the selected group's members. Changing group
  // resets the selection since the old participants may not be members.
  useEffect(() => {
    if (!user || !selectedGroupId) return;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return;
    setParticipantsMeta(group.members);
    setSelectedParticipants([user.id]);
    setPaidBy(user.id);
  }, [user, selectedGroupId, groups]);

  // Auto-split when participants or total changes (even mode only)
  useEffect(() => {
    if (splitMode === "even" && selectedParticipants.length > 0 && totalAmount > 0) {
      const evenAmount = Math.round((totalAmount / selectedParticipants.length) * 100) / 100;
      const remainder = Math.round((totalAmount - evenAmount * selectedParticipants.length) * 100) / 100;
      const newValues: Record<string, number> = {};
      selectedParticipants.forEach((pid, i) => {
        newValues[pid] =
          i === selectedParticipants.length - 1
            ? Math.round((evenAmount + remainder) * 100) / 100
            : evenAmount;
      });
      setSplitValues(newValues);
    }
  }, [splitMode, selectedParticipants, totalAmount]);

  // ── Scan flow ──────────────────────────────────────────────────────

  /** Feed an extracted receipt into the flow (shared by real + mock paths). */
  const loadReceiptData = useCallback((data: ReceiptExtractionResult) => {
    setScanResult(data);
    setScanItems(data.menu);
    setScanStatus("extracted");
    setShowAssigner(true);
  }, []);

  /** Debug: load a canned receipt without calling the LLM API. */
  const loadMockReceipt = useCallback(
    (name: string) => {
      const mock = MOCK_RECEIPTS.find((m) => m.name === name);
      if (!mock) return;
      setError(null);
      loadReceiptData(mock.data);
    },
    [loadReceiptData]
  );

  const handleScanUpload = useCallback(
    async (file: File) => {
      setScanStatus("uploading");
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/receipts/extract", {
          method: "POST",
          body: formData,
        });

        const json: ExtractApiResponse = await response.json();

        if (!json.success) {
          setError(json.error || ERROR_MESSAGES.UNKNOWN);
          setScanStatus("error");
          return;
        }

        loadReceiptData(json.data);
      } catch (err) {
        setError(mapErrorMessage(err));
        setScanStatus("error");
      }
    },
    [loadReceiptData]
  );

  /** Called after user confirms item assignments in the ItemAssigner */
  const handleAssignmentsConfirmed = useCallback(
    (result: AssignmentResult) => {
      const { items: assignedItems, assignmentsByItem, totals, unitState: newUnitState } = result;
      setUnitState(newUnitState);

      // Persist the (possibly edited) items back to state
      setScanItems(assignedItems);

      // Set title from scan if not already set
      if (!title) {
        setTitle(`Receipt — ${new Date().toLocaleDateString()}`);
      }

      // Total = sum of edited item prices
      const newTotal = assignedItems.reduce((s, it) => s + it.price, 0);
      setTotalAmount(Math.round(newTotal * 100) / 100);

      // Anyone who ended up with a share becomes a participant
      const involvedUserIds = Object.entries(totals)
        .filter(([, amt]) => amt > 0)
        .map(([uid]) => uid);
      if (involvedUserIds.length > 0) {
        setSelectedParticipants(involvedUserIds);
      }

      // The assigner already resolved exact per-item, per-user shares
      // (may be uneven across multi-quantity units).
      setSavedAssignments(assignmentsByItem);
      setAllocationTotals(totals);

      // Prefill split values from item assignment totals (still editable)
      setSplitValues(totals);
      setSplitMode("custom");
      setShowAssigner(false);
      setScanStatus("idle");
    },
    [title]
  );

  /** Re-apply the allocation result to the custom split fields. */
  const applyAllocationToSplit = useCallback(() => {
    if (!allocationTotals) return;
    const involved = Object.entries(allocationTotals)
      .filter(([, amt]) => amt > 0)
      .map(([uid]) => uid);
    if (involved.length > 0) setSelectedParticipants(involved);
    setSplitValues({ ...allocationTotals });
    setSplitMode("custom");
  }, [allocationTotals]);

  const handleScanRetry = useCallback(() => {
    setScanStatus("idle");
    setScanResult(null);
    setScanItems([]);
    setError(null);
  }, []);

  // ── Editing scanned items ─────────────────────────────────────────

  const updateItem = (index: number, field: "nm" | "price", value: string | number) => {
    setScanItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const deleteItem = (index: number) => {
    setScanItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setScanItems((prev) => [...prev, { nm: "Item", price: 0, cnt: 1 }]);
  };

  // ── Save ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setShowAllErrors(true);
    if (!user || !title.trim() || totalAmount <= 0 || selectedParticipants.length === 0) return;

    if (!selectedGroupId) {
      setError("Pick a group — transactions happen within a group");
      return;
    }

    // Validate items have non-empty names
    if (scanItems.some(item => !item.nm || item.nm.trim() === '')) {
      setError("All items must have names");
      return;
    }

    setSaving(true);
    setError(null);

    // Validate custom split totals. Sum only over the *selected* participants
    // — the same set we send below — so a stale splitValues entry for someone
    // removed from the picker after allocation can't slip a bad split past the
    // frontend only to be rejected by the backend.
    if (splitMode === "custom") {
      const splitTotal = selectedParticipants.reduce(
        (s, pid) => s + (splitValues[pid] ?? 0),
        0
      );
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        setError(
          ERROR_MESSAGES.TX_SPLIT_MISMATCH(splitTotal.toFixed(2), totalAmount.toFixed(2))
        );
        setSaving(false);
        return;
      }
    }

    // Build participants
    const transactionParticipants = selectedParticipants.map((pid) => ({
      userId: pid,
      shareAmount:
        splitMode === "even"
          ? Math.round((totalAmount / selectedParticipants.length) * 100) / 100
          : splitValues[pid] ?? 0,
    }));

    // Handle rounding for even split
    if (splitMode === "even") {
      const total = transactionParticipants.reduce((s, p) => s + p.shareAmount, 0);
      const diff = Math.round((totalAmount - total) * 100) / 100;
      if (Math.abs(diff) > 0.001 && transactionParticipants.length > 0) {
        transactionParticipants[transactionParticipants.length - 1].shareAmount =
          Math.round(
            (transactionParticipants[transactionParticipants.length - 1].shareAmount + diff) * 100
          ) / 100;
      }
    }

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          totalAmount,
          paidByUserId: paidBy,
          groupId: selectedGroupId,
          transactionDate: date,
          items: scanItems.length > 0 ? scanItems.map(item => ({
            name: item.nm || "Item", // Convert nm to name field, fallback to "Item"
            quantity: item.cnt || 1, // Convert cnt to quantity field, fallback to 1
            price: item.price
          })) : undefined,
          participants: transactionParticipants,
          itemAssignments: savedAssignments,
        }),
      });

      const json = await response.json();
      if (json.success) {
        window.location.href = `/groups/${selectedGroupId}`;
      } else {
        setDialogError({
          title: "Save failed",
          message: json.error || ERROR_MESSAGES.FAILED_TO_SAVE,
        });
      }
    } catch (err) {
      setDialogError({
        title: "Save failed",
        message: mapErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  }, [
    user,
    title,
    totalAmount,
    date,
    selectedParticipants,
    paidBy,
    selectedGroupId,
    splitMode,
    splitValues,
    scanItems,
    savedAssignments,
  ]);

  const totalFromItems = scanItems.reduce((s, i) => s + i.price, 0);

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← Back
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-1">New Transaction</h1>
      <a
        href={`/payments/new${selectedGroupId ? `?groupId=${selectedGroupId}` : ""}`}
        className="text-sm font-medium text-[var(--primary)] mb-6 block"
      >
        💸 Paying someone back? Record a payment →
      </a>

      {groupsLoaded && groups.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-8 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Transactions happen within a group — you&apos;re not in any yet.
          </p>
          <button
            onClick={() => (window.location.href = "/groups")}
            className="text-sm font-medium text-[var(--primary)]"
          >
            Create a group first →
          </button>
        </div>
      ) : (
      <div className="space-y-5">
        {/* ── Group ──────────────────────────────────────────────── */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Group</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* ── Description ────────────────────────────────────────── */}
        <FormField
          label="Description"
          value={title}
          validate={(v) => (!(v as string)?.trim() ? "Enter a description" : null)}
          showError={showAllErrors}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dinner at Sakura, Groceries"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </FormField>

        {/* ── Scan receipt button ────────────────────────────────── */}
        {scanStatus === "idle" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Scan a receipt instead?</p>
            <button
              onClick={() => setScanStatus("choosing")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-[var(--primary)] border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--primary)] hover:bg-blue-50 transition-colors"
            >
              <span className="text-lg">📸</span>
              Scan a receipt
            </button>

            {/* Debug toggle: mock scan (skip the LLM API) */}
            {DEBUG_UI && (
              <label className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                <input
                  type="checkbox"
                  checked={mockScan}
                  onChange={(e) => setMockScan(e.target.checked)}
                />
                🐛 Mock scan (load test data, no API call)
              </label>
            )}
          </div>
        )}

        {/* ── Scan: real uploader ─────────────────────────────────── */}
        {scanStatus === "choosing" && !mockScan && (
          <ReceiptUploader onUpload={handleScanUpload} disabled={saving} />
        )}

        {/* ── Scan: mock receipt picker (debug) ───────────────────── */}
        {scanStatus === "choosing" && mockScan && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)] bg-amber-50 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                🐛 Load test receipt
              </h2>
              <button
                onClick={() => setScanStatus("idle")}
                className="text-xs text-gray-400"
              >
                Cancel
              </button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {MOCK_RECEIPTS.map((m) => (
                <button
                  key={m.name}
                  onClick={() => loadMockReceipt(m.name)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{m.label}</span>
                  <span className="text-xs font-mono text-gray-400">
                    ${m.data.total_price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {scanStatus === "error" && error && (
          <ErrorAlert message={error} onRetry={handleScanRetry} />
        )}

        {/* ── Scanned items: EDITABLE (before allocation) ────────── */}
        {scanItems.length > 0 && !showAssigner && !savedAssignments && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Receipt Items
              </h2>
              <button onClick={addItem} className="text-xs font-medium text-[var(--primary)]">
                + Add
              </button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {scanItems.map((item, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={item.nm}
                    onChange={(e) => updateItem(i, "nm", e.target.value)}
                    placeholder="Item name"
                    className="flex-1 px-2 py-1 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] min-w-0"
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="w-20 px-2 py-1 text-sm text-right border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <button
                    onClick={() => deleteItem(i)}
                    className="text-xs text-[var(--danger)] px-1 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => setShowAssigner(true)}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
              >
                Assign items to people →
              </button>
            </div>
          </div>
        )}

        {/* ── Scanned items: READ-ONLY (after allocation) ────────── */}
        {scanItems.length > 0 && !showAssigner && savedAssignments && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Receipt &amp; Allocation
              </h2>
              <button
                onClick={() => setShowAssigner(true)}
                className="text-xs font-medium text-[var(--primary)]"
              >
                ✎ Edit
              </button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {scanItems.map((item, i) => {
                const assignees = savedAssignments[i] ?? [];
                return (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.nm}
                        {item.cnt && item.cnt > 1 ? (
                          <span className="text-xs text-gray-400 ml-1">×{item.cnt}</span>
                        ) : null}
                      </span>
                      <span className="text-sm font-mono text-gray-700 shrink-0">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    {assignees.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {assignees.map((a) => {
                          const p = participantsMeta.find((pp) => pp.id === a.userId);
                          return (
                            <span
                              key={a.userId}
                              className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                            >
                              <UserAvatar name={p?.name ?? "?"} size="sm" />
                              {(p?.name ?? "?").split(" ")[0]}
                              <span className="font-mono text-gray-400">
                                ${a.shareAmount.toFixed(2)}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)] bg-gray-50">
              <button
                onClick={applyAllocationToSplit}
                className="w-full px-4 py-2.5 text-sm font-medium text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-blue-50 transition-colors"
              >
                ↺ Reset split to allocation
              </button>
              <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                Overwrites the custom split below with these amounts
              </p>
            </div>
          </div>
        )}

        {/* ── Item assigner (full-screen "pass the phone" flow) ──── */}
        {showAssigner && scanItems.length > 0 && (
          <ItemAssigner
            items={scanItems.map((item, idx) => ({ ...item, id: idx }))}
            participants={participantsMeta}
            initialUnitState={unitState}
            onConfirm={handleAssignmentsConfirmed}
            onCancel={() => {
              setShowAssigner(false);
              if (scanItems.length === 0) setScanStatus("idle");
            }}
          />
        )}

        {/* ── Total amount ───────────────────────────────────────── */}
        <FormField
          label="Total amount"
          value={totalAmount}
          validate={(v) => ((v as number) <= 0 ? "Enter an amount greater than $0" : null)}
          showError={showAllErrors}
          labelSuffix={
            scanItems.length > 0 ? (
              <span className="text-gray-400 font-normal ml-1">
                (from items: ${totalFromItems.toFixed(2)})
              </span>
            ) : undefined
          }
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              $
            </span>
            <input
              type="number"
              value={totalAmount || ""}
              onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </FormField>

        {/* ── Date ───────────────────────────────────────────────── */}
        <FormField
          label="Date"
          value={date}
          validate={(v) => (!(v as string)?.trim() ? "Select a date" : null)}
          showError={showAllErrors}
        >
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </FormField>

        {/* ── Participants ────────────────────────────────────────── */}
        <FormField
          label="Who's involved?"
          value={selectedParticipants}
          validate={(v) => ((v as string[]).length === 0 ? "Select at least one person" : null)}
          showError={showAllErrors}
        >
          <UserPicker
            selectedUserIds={selectedParticipants}
            onChange={setSelectedParticipants}
            users={participantsMeta as any}
            label=""
          />
        </FormField>

        {/* ── Split method ────────────────────────────────────────── */}
        {selectedParticipants.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Split</label>
            <SplitInput
              participants={participantsMeta.filter((p) => selectedParticipants.includes(p.id))}
              totalAmount={totalAmount}
              values={splitValues}
              onChange={setSplitValues}
              mode={splitMode}
              onModeChange={setSplitMode}
            />
          </div>
        )}

        {/* ── Paid by (can be anyone, not only those involved) ────── */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Paid by</label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {participantsMeta.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === user.id ? "You" : p.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && !showAllErrors && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        {/* ── Save ───────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={
            saving ||
            !title.trim() ||
            totalAmount <= 0 ||
            selectedParticipants.length === 0
          }
          className="w-full px-4 py-3 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save transaction"}
        </button>
      </div>
      )}

      {/* ── Loading overlays ──────────────────────────────────────── */}
      {scanStatus === "uploading" && <LoadingOverlay />}
      {saving && <LoadingOverlay />}

      {/* ── Error dialog (POST save failures) ─────────────────────── */}
      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}
