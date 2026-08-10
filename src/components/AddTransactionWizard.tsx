"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UserPicker from "@/components/UserPicker";
import SplitInput from "@/components/SplitInput";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";
import Step2_InputMethod from "./wizard/Step2_InputMethod";
import Step3_ExpensePeople from "./wizard/Step3_ExpensePeople";
import Step3b_ManualExpenseDetails from "./wizard/Step3b_ManualExpenseDetails";
import Step3_ScanDetails from "./wizard/Step3_ScanDetails";
import Step4_SplitMethod from "./wizard/Step4_SplitMethod";
import Step4_ItemAssignment from "./wizard/Step4_ItemAssignment";
import Step5_Review from "./wizard/Step5_Review";
import ItemAssigner from "@/components/ItemAssigner";

const TOTAL_STEPS = 5;

/**
 * Multi-step wizard for adding an expense.
 *
 * Expense-only by design: "Add" in the nav is the expense path and drops
 * straight into "how do you want to add it?". Paying someone back is not a
 * thing you do from the global Add tab — it only makes sense inside a group,
 * where you can see who you owe, so it lives on the group page and is handled
 * by /payments/new.
 */
export default function AddTransactionWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<any>(null);

  // Read query params for deep-link support (e.g. /transactions/new?groupId=…)
  const queryGroupId = searchParams.get("groupId") || "";
  const queryAmount = parseFloat(searchParams.get("amount") || "") || 0;

  // Input method state
  const [inputMethod, setInputMethod] = useState<"scan" | "manual">("manual");

  // Core transaction data
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedGroupId, setSelectedGroupId] = useState(queryGroupId);
  const [paidBy, setPaidBy] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Split state
  const [splitMode, setSplitMode] = useState<"even" | "custom">("even");
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});

  // Item assignment state (for scan flow)
  const [assignmentResults, setAssignmentResults] = useState<any>(null);
  // Scan flow's step 4 has two phases: assigning items, then adjusting the
  // resulting split (which also shows the allocation for re-editing).
  const [scanSplitPhase, setScanSplitPhase] = useState<"assign" | "adjust">("assign");

  // Scanning state
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanItems, setScanItems] = useState<any[]>([]);
  const [scanStatus, setScanStatus] = useState<"idle" | "uploading" | "extracted" | "error">("idle");

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  // Derived states
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // Group members for the currently selected group — used to scope
  // the participant picker to group members only.
  const groupMembers = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = groups.find((g: any) => g.id === selectedGroupId);
    return group?.members || [];
  }, [selectedGroupId, groups]);

  const plan = [] as any[];
  const balance = null as any;

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) return;
    setUser(currentUser);
    setPaidBy(currentUser.id);

    // Load groups (each group includes its members — no separate /api/users
    // fetch needed; participant lists are scoped to group members below).
    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setGroups(json.data);
      })
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoaded(true));

    // Deep-link query params are consumed at init time (lines above via
    // useSearchParams), so state is already seeded correctly.
  }, []);

  // Both branches are 5 steps and diverge only at 2 and 4:
  //   scan:   1 Method → 2 Scan details → 3 People → 4 Items  → 5 Review
  //   manual: 1 Method → 2 Details      → 3 People → 4 Split  → 5 Review
  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  /**
   * Return to wherever the wizard was opened from — the group page, the tab
   * you were on before Add, whatever pushed us here.
   *
   * `history.length` guards the case where /transactions/new was the entry URL
   * (shared link, hard refresh, PWA cold start): there's nothing to go back to,
   * so fall back to the group we were deep-linked into, else home.
   */
  const leaveWizard = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(queryGroupId ? `/groups/${queryGroupId}` : "/");
  };

  // Step 1 has nowhere to go back to inside the wizard, so its Back leaves.
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else leaveWizard();
  };

  /**
   * Clear the draft, then leave.
   *
   * The reset is not optional: /transactions/new is one of the four tabs
   * PageSlider keeps mounted at once, so this component survives navigating
   * away — without it you'd come back to a half-filled wizard on step 4.
   */
  const handleCancel = () => {
    const currentUser = getSessionUser();
    setStep(1);
    setInputMethod("manual");
    setAmount(queryAmount);
    setDate(new Date().toISOString().split("T")[0]);
    setSelectedGroupId(queryGroupId);
    setPaidBy(currentUser?.id || "");
    setSelectedParticipants([]);
    setTitle("");
    setDescription("");
    setSplitMode("even");
    setSplitValues({});
    setScanResult(null);
    setScanItems([]);
    setScanStatus("idle");
    setAssignmentResults(null);
    setScanSplitPhase("assign");
    setError(null);
    setDialogError(null);

    leaveWizard();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (!amount || !selectedGroupId || !paidBy || selectedParticipants.length === 0) {
        setError("Please fill in all required fields");
        return;
      }

      // splitValues is the live source of truth for both flows: seeded from
      // even/custom entry for manual, seeded from the item allocation (then
      // freely editable) for scan.
      const transactionParticipants = selectedParticipants.map((pid) => ({
        userId: pid,
        shareAmount:
          splitMode === "even"
            ? Math.round((amount / selectedParticipants.length) * 100) / 100
            : splitValues[pid] ?? 0,
      }));

      // Handle rounding for even split
      if (splitMode === "even") {
        const total = transactionParticipants.reduce((s, p) => s + p.shareAmount, 0);
        const diff = Math.round((amount - total) * 100) / 100;
        if (Math.abs(diff) > 0.001 && transactionParticipants.length > 0) {
          transactionParticipants[transactionParticipants.length - 1].shareAmount =
            Math.round((transactionParticipants[transactionParticipants.length - 1].shareAmount + diff) * 100) / 100;
        }
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Expense",
          totalAmount: amount,
          paidByUserId: paidBy,
          groupId: selectedGroupId,
          transactionDate: date,
          participants: transactionParticipants,
          items: scanItems.length > 0 ? scanItems.map(item => ({
            name: item.nm || "Item",
            quantity: item.cnt || 1,
            price: item.price || 0
          })) : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        window.location.href = "/activity";
      } else {
        setError(json.error || "Failed to save transaction");
      }
    } catch (err) {
      setDialogError({ title: "Save failed", message: "Failed to connect to the server" });
    } finally {
      setSaving(false);
    }
  };

  // Shared between the manual Split step and the scan flow's post-allocation
  // adjust step — both render Step4_SplitMethod against the same people.
  const splitParticipants = selectedParticipants.map((id) => {
    const member = groupMembers.find((u: any) => u.id === id);
    return { id, name: member?.name || "" };
  });

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step2_InputMethod
            inputMethod={inputMethod}
            onMethodChange={(method) => {
              setInputMethod(method);
              if (method === "manual") handleNext();
            }}
            onNext={handleNext}
            onBack={handleBack}
            onScan={(response) => {
              setScanResult(response.data);
              setScanItems(response.data.menu);
              setScanStatus("extracted");
              setAmount(response.data.total_price || 0);
              // Auto-populate title from merchant if available
              if (response.data.merchant) {
                setTitle(response.data.merchant);
              }
              // After scan, go straight to the details step
              setStep(2);
            }}
            amount={amount}
            setAmount={setAmount}
            date={date}
            setDate={setDate}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
            groups={groups}
            user={user}
          />
        );
      case 2:
        if (inputMethod === "manual") {
          return (
            <Step3b_ManualExpenseDetails
              amount={amount}
              setAmount={setAmount}
              date={date}
              setDate={setDate}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
              groups={groups}
              user={user}
              onNext={handleNext}
              onBack={handleBack}
              title={title}
              setTitle={setTitle}
            />
          );
        } else {
          // For scan mode, show simplified details (no amount input needed)
          return (
            <Step3_ScanDetails
              title={title}
              setTitle={setTitle}
              date={date}
              setDate={setDate}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
              groups={groups}
              amount={amount}
              onNext={handleNext}
              onBack={handleBack}
            />
          );
        }
      case 3:
        return (
          <Step3_ExpensePeople
            paidBy={paidBy}
            setPaidBy={setPaidBy}
            selectedParticipants={selectedParticipants}
            setSelectedParticipants={setSelectedParticipants}
            user={user}
            users={groupMembers}
            selectedGroupId={selectedGroupId}
            amount={amount}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        if (inputMethod === "scan") {
          if (scanSplitPhase === "assign") {
            // Scan flow, phase 1: item assignment
            return (
              <Step4_ItemAssignment
                scanItems={assignmentResults ? assignmentResults.items : scanItems}
                selectedParticipants={selectedParticipants}
                users={groupMembers}
                initialUnitState={assignmentResults?.unitState}
                onAssign={(results) => {
                  setAssignmentResults(results);
                  setSplitValues(results.totals);
                  setSplitMode("custom");
                  setScanSplitPhase("adjust");
                }}
                onBack={handleBack}
              />
            );
          }
          // Scan flow, phase 2: adjust the resulting split, with the
          // allocation shown above it for re-editing.
          const allocationTotal =
            Math.round(
              Object.values(assignmentResults?.totals ?? {}).reduce(
                (s: number, v: any) => s + v,
                0
              ) * 100
            ) / 100;
          return (
            <Step4_SplitMethod
              splitMode={splitMode}
              onModeChange={setSplitMode}
              splitValues={splitValues}
              onChange={setSplitValues}
              participants={splitParticipants}
              totalAmount={amount}
              onNext={handleNext}
              onBack={() => setScanSplitPhase("assign")}
              assignmentResults={assignmentResults}
              onEditAllocation={() => setScanSplitPhase("assign")}
              allocationTotal={allocationTotal}
              onUseAllocationTotal={() => setAmount(allocationTotal)}
            />
          );
        }
        // Manual flow: Split method
        return (
          <Step4_SplitMethod
            splitMode={splitMode}
            onModeChange={setSplitMode}
            splitValues={splitValues}
            onChange={setSplitValues}
            participants={splitParticipants}
            totalAmount={amount}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <Step5_Review
            amount={amount}
            date={date}
            title={title}
            paidBy={paidBy}
            selectedGroupId={selectedGroupId}
            selectedParticipants={selectedParticipants}
            splitMode={splitMode}
            splitValues={splitValues}
            onSave={handleSave}
            onBack={handleBack}
            saving={saving}
            user={user}
            groups={groups}
            users={groupMembers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-dvh px-4 pt-6 pb-40 max-w-lg mx-auto">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {/* On step 1 nothing has been entered yet, so this is just "leave" —
              calling it Cancel there implies you're throwing something away. */}
          <button
            onClick={handleCancel}
            className="text-sm text-ink-muted hover:text-ink"
          >
            {step === 1 ? "← Back" : "← Cancel"}
          </button>
          <span className="text-sm font-semibold text-[var(--primary)]">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1 bg-canvas rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {renderStep()}

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </div>
  );
}

// Step components will be added next
