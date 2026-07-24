"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import UserPicker from "@/components/UserPicker";
import SplitInput from "@/components/SplitInput";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";
import Step1_ChooseType from "./wizard/Step1_ChooseType";
import Step2_InputMethod from "./wizard/Step2_InputMethod";
import Step2_PaymentDetails from "./wizard/Step2_PaymentDetails";
import Step3_ExpensePeople from "./wizard/Step3_ExpensePeople";
import Step3b_ManualExpenseDetails from "./wizard/Step3b_ManualExpenseDetails";
import Step3_ScanProcessing from "./wizard/Step3_ScanProcessing";
import Step3_ScanDetails from "./wizard/Step3_ScanDetails";
import Step4_SplitMethod from "./wizard/Step4_SplitMethod";
import Step4_ItemAssignment from "./wizard/Step4_ItemAssignment";
import Step5_Review from "./wizard/Step5_Review";
import ItemAssigner from "@/components/ItemAssigner";

/**
 * Multi-step wizard for adding transactions
 * Breaks down the complex form into focused steps
 */
export default function AddTransactionWizard() {
  const router = useRouter();
  const params = useParams();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<any>(null);

  // Transaction type state
  const [txType, setTxType] = useState<"expense" | "payment">("expense");

  // Input method state (for expense)
  const [inputMethod, setInputMethod] = useState<"scan" | "manual">("manual");

  // Core transaction data
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedGroupId, setSelectedGroupId] = useState(params.groupId as string || "");
  const [paidBy, setPaidBy] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [toUserId, setToUserId] = useState(params.toUserId as string || "");
  const [description, setDescription] = useState("");

  // Split state
  const [splitMode, setSplitMode] = useState<"even" | "custom">("even");
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});

  // Item assignment state (for scan flow)
  const [assignmentResults, setAssignmentResults] = useState<any>(null);

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
  const [users, setUsers] = useState<any[]>([]);
  const recipients = users; // All users can be payment recipients
  const plan = [] as any[];
  const balance = null as any;

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) return;
    setUser(currentUser);
    setPaidBy(currentUser.id);

    // Load users
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUsers(json.data);
      })
      .catch(() => setUsers([]));

    // Load groups
    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setGroups(json.data);
      })
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoaded(true));

    // If groupId is in URL params, pre-select it
    if (params.groupId) {
      setSelectedGroupId(params.groupId as string);
    }

    // If toUserId is in URL params, pre-select it
    if (params.toUserId) {
      setToUserId(params.toUserId as string);
    }

    // If amount is in URL params (from settle-up flow), pre-fill it
    if (params.amount) {
      setAmount(parseFloat(params.amount as string) || 0);
    }
  }, []);

  const handleNext = () => {
    // For payments: max 3 steps
    if (txType === "payment") {
      if (step < 3) setStep(step + 1);
      return;
    }

    // For expenses with scan: different flow
    if (txType === "expense" && inputMethod === "scan") {
      // Scan flow: 1→2→3→4→5→6
      // 1: Choose type, 2: Method, 3: Details, 4: People, 5: Items, 6: Review
      if (step < 6) setStep(step + 1);
      return;
    }

    // For expenses with manual: 1→2→3→4→5→6
    // 1: Choose type, 2: Method, 3: Details, 4: People, 5: Split, 6: Review
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCancel = () => {
    const currentUser = getSessionUser();
    setStep(1);
    setTxType("expense");
    setInputMethod("manual");
    setAmount(0);
    setDate(new Date().toISOString().split("T")[0]);
    setSelectedGroupId(params.groupId as string || "");
    setPaidBy(currentUser?.id || "");
    setSelectedParticipants([]);
    setTitle("");
    setToUserId(params.toUserId as string || "");
    setDescription("");
    setSplitMode("even");
    setSplitValues({});
    setScanResult(null);
    setScanItems([]);
    setScanStatus("idle");
    setAssignmentResults(null);
    setError(null);
    setDialogError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Payment mode
      if (txType === "payment") {
        if (!amount || !selectedGroupId || !toUserId) {
          setError("Please fill in all required fields");
          return;
        }

        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Payment to ${toUserId}`,
            totalAmount: amount,
            paidByUserId: user.id,
            groupId: selectedGroupId,
            transactionDate: date,
            type: "payment",
            participants: [{ userId: toUserId, shareAmount: amount }],
          }),
        });

        const json = await res.json();
        if (json.success) {
          window.location.href = "/activity";
        } else {
          setError(json.error || "Failed to save payment");
        }
        return;
      }

      // Expense mode
      if (!amount || !selectedGroupId || !paidBy || selectedParticipants.length === 0) {
        setError("Please fill in all required fields");
        return;
      }

      let transactionParticipants;

      // For scan flow with item assignments, use assignment results
      if (inputMethod === "scan" && assignmentResults) {
        transactionParticipants = selectedParticipants.map((pid) => ({
          userId: pid,
          shareAmount: assignmentResults.totals[pid] ?? 0,
        }));
      } else {
        // For manual flow, use split calculations
        transactionParticipants = selectedParticipants.map((pid) => ({
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
      }

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

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1_ChooseType
            txType={txType}
            onTypeChange={setTxType}
            onNext={handleNext}
          />
        );
      case 2:
        if (txType === "expense") {
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
                // After scan, directly go to step 3
                setStep(3);
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
        } else {
          return (
            <Step2_PaymentDetails
              amount={amount}
              setAmount={setAmount}
              date={date}
              setDate={setDate}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
              toUserId={toUserId}
              setToUserId={setToUserId}
              groups={groups}
              recipients={recipients}
              user={user}
              onNext={handleNext}
              onBack={handleBack}
            />
          );
        }
      case 3:
        if (txType === "payment") {
          return (
            <Step5_Review
              txType={txType}
              amount={amount}
              date={date}
              title={title}
              paidBy={paidBy}
              toUserId={toUserId}
              selectedGroupId={selectedGroupId}
              selectedParticipants={selectedParticipants}
              splitMode={splitMode}
              splitValues={splitValues}
              onSave={handleSave}
              onBack={handleBack}
              saving={saving}
              user={user}
              groups={groups}
              users={users}
              inputMethod={inputMethod}
              assignmentResults={assignmentResults}
            />
          );
        }
        if (txType === "expense" && inputMethod === "manual") {
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
        } else if (txType === "expense" && inputMethod === "scan") {
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
        return null;
      case 4:
        if (txType === "expense") {
          return (
            <Step3_ExpensePeople
              paidBy={paidBy}
              setPaidBy={setPaidBy}
              selectedParticipants={selectedParticipants}
              setSelectedParticipants={setSelectedParticipants}
              user={user}
              users={users}
              selectedGroupId={selectedGroupId}
              onNext={handleNext}
              onBack={handleBack}
            />
          );
        }
        return null;
      case 5:
        if (txType === "expense" && inputMethod === "scan") {
          // Scan flow: Item assignment
          return (
            <Step4_ItemAssignment
              scanItems={scanItems}
              selectedParticipants={selectedParticipants}
              users={users}
              onAssign={(results) => {
                setAssignmentResults(results);
                handleNext();
              }}
              onBack={handleBack}
            />
          );
        }
        if (txType === "expense" && inputMethod === "manual") {
          // Manual flow: Split method
          return (
            <Step4_SplitMethod
              splitMode={splitMode}
              onModeChange={setSplitMode}
              splitValues={splitValues}
              onChange={setSplitValues}
              participants={selectedParticipants.map(id => {
                const user = users.find((u: any) => u.id === id);
                return { id, name: user?.name || "" };
              })}
              totalAmount={amount}
              onNext={handleNext}
              onBack={handleBack}
            />
          );
        }
        return null;
      case 6:
        return (
          <Step5_Review
            txType={txType}
            amount={amount}
            date={date}
            title={title}
            paidBy={paidBy}
            toUserId={toUserId}
            selectedGroupId={selectedGroupId}
            selectedParticipants={selectedParticipants}
            splitMode={splitMode}
            splitValues={splitValues}
            onSave={handleSave}
            onBack={handleBack}
            saving={saving}
            user={user}
            groups={groups}
            users={users}
            inputMethod={inputMethod}
            assignmentResults={assignmentResults}
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
          <button
            onClick={handleCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Cancel
          </button>
          <span className="text-sm font-semibold text-[var(--primary)]">
            Step {step} of {txType === "payment" ? "3" : "6"}
          </span>
        </div>
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-300"
            style={{
              width: `${(step / (txType === "payment" ? 3 : 6)) * 100}%`
            }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
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
