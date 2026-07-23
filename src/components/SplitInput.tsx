"use client";

import { useState, useCallback } from "react";
import UserAvatar from "./UserAvatar";
import CalculatorKeypad from "./CalculatorKeypad";

interface Participant {
  id: string;
  name: string;
}

interface SplitInputProps {
  participants: Participant[];
  totalAmount: number;
  values: Record<string, number>; // userId → amount
  onChange: (values: Record<string, number>) => void;
  mode: "even" | "custom";
  onModeChange: (mode: "even" | "custom") => void;
}

/**
 * Split method input: toggles between "Even split" and "Custom split."
 * In custom mode, shows per-person $ input fields with live remaining indicator.
 */
export default function SplitInput({
  participants,
  totalAmount,
  values,
  onChange,
  mode,
  onModeChange,
}: SplitInputProps) {
  const [splitType, setSplitType] = useState<"amount" | "percent">("amount");
  const [percentValues, setPercentValues] = useState<Record<string, number>>({});
  const [keypadUserId, setKeypadUserId] = useState<string | null>(null);

  const splitEven = useCallback(() => {
    const evenAmount = Math.round((totalAmount / participants.length) * 100) / 100;
    const remainder = Math.round((totalAmount - evenAmount * participants.length) * 100) / 100;
    const newValues: Record<string, number> = {};
    participants.forEach((p, i) => {
      newValues[p.id] = i === participants.length - 1
        ? Math.round((evenAmount + remainder) * 100) / 100 // last person gets the rounding
        : evenAmount;
    });
    onChange(newValues);

    // Set percentages too
    const evenPct = Math.round(100 / participants.length);
    const pctRemainder = 100 - evenPct * participants.length;
    const newPcts: Record<string, number> = {};
    participants.forEach((p, i) => {
      newPcts[p.id] = i === participants.length - 1 ? evenPct + pctRemainder : evenPct;
    });
    setPercentValues(newPcts);
  }, [totalAmount, participants, onChange]);

  const updateAmount = useCallback((userId: string, amount: number) => {
    const newValues = { ...values };
    newValues[userId] = Math.max(0, amount);
    onChange(newValues);

    // Auto-update percentage
    const pct = totalAmount > 0 ? (newValues[userId] / totalAmount) * 100 : 0;
    setPercentValues((prev) => ({ ...prev, [userId]: Math.round(pct * 100) / 100 }));
  }, [values, totalAmount, onChange]);

  const updatePercent = useCallback((userId: string, pct: number) => {
    const clampedPct = Math.max(0, Math.min(100, pct));
    setPercentValues((prev) => ({ ...prev, [userId]: clampedPct }));
    const amount = Math.round((totalAmount * clampedPct / 100) * 100) / 100;
    const newValues = { ...values };
    newValues[userId] = amount;
    onChange(newValues);
  }, [totalAmount, values, onChange]);

  const totalAllocated = Object.values(values).reduce((sum, v) => sum + v, 0);
  const remaining = Math.round((totalAmount - totalAllocated) * 100) / 100;
  const isBalanced = Math.abs(remaining) < 0.01;

  return (
    <>
      <div className="space-y-3">
        {/* Toggle */}
        <div className="flex gap-2 rounded-lg p-1 w-fit backdrop-blur-sm"
             style={{
               background: 'linear-gradient(135deg, rgba(248,250,252,0.4) 0%, rgba(243,244,246,0.3) 100%)',
               boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 2px 6px rgba(0,0,0,0.04)'
             }}>
          <button
            onClick={() => { onModeChange("even"); splitEven(); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              mode === "even" ? "text-gray-900" : "text-gray-500"
            }`}
            style={mode === "even" ? {
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.85) 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04)'
            } : {}}
          >
            Even split
          </button>
          <button
            onClick={() => { onModeChange("custom"); splitEven(); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              mode === "custom" ? "text-gray-900" : "text-gray-500"
            }`}
            style={mode === "custom" ? {
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.85) 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04)'
            } : {}}
          >
            Custom split
          </button>
        </div>

        {/* Per-person fields */}
        {mode === "custom" && (
          <>
            {/* Amount/Percent toggle */}
            <div className="flex gap-2 rounded-full p-1 w-fit backdrop-blur-sm"
                 style={{
                   background: 'linear-gradient(135deg, rgba(248,250,252,0.4) 0%, rgba(243,244,246,0.3) 100%)',
                   boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 2px 6px rgba(0,0,0,0.04)'
                 }}>
              <button
                onClick={() => setSplitType("amount")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  splitType === "amount" ? "text-white" : "text-gray-500"
                }`}
                style={splitType === "amount" ? {
                  background: 'linear-gradient(135deg, rgba(58,133,197,0.95) 0%, rgba(42,107,165,0.9) 100%)',
                  boxShadow: '0 1px 2px rgba(58,133,197,0.2), 0 2px 4px rgba(58,133,197,0.15), 0 4px 8px rgba(0,0,0,0.08)'
                } : {}}
              >
                $
              </button>
              <button
                onClick={() => setSplitType("percent")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  splitType === "percent" ? "text-white" : "text-gray-500"
                }`}
                style={splitType === "percent" ? {
                  background: 'linear-gradient(135deg, rgba(58,133,197,0.95) 0%, rgba(42,107,165,0.9) 100%)',
                  boxShadow: '0 1px 2px rgba(58,133,197,0.2), 0 2px 4px rgba(58,133,197,0.15), 0 4px 8px rgba(0,0,0,0.08)'
                } : {}}
              >
                %
              </button>
            </div>

            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <UserAvatar name={p.name} size="sm" />
                  <span className="text-sm font-medium text-gray-700 flex-1">{p.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">
                      {splitType === "amount" ? "$" : ""}
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={splitType === "amount"
                        ? (values[p.id] ?? 0).toFixed(2)
                        : (percentValues[p.id] ?? 0).toFixed(0)
                      }
                      onClick={() => setKeypadUserId(p.id)}
                      className="w-20 px-2 py-1.5 text-right text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer bg-white"
                    />
                    <span className="text-xs text-gray-400">
                      {splitType === "percent" ? "%" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Remaining indicator */}
            <div className={`text-sm font-medium ${
              isBalanced ? "text-[var(--success)]" : remaining < 0 ? "text-[var(--danger)]" : "text-amber-500"
            }`}>
              {isBalanced
                ? "✓ Fully allocated"
                : `${remaining > 0 ? "Remaining" : "Over by"}: $${Math.abs(remaining).toFixed(2)}`
              }
            </div>
          </>
        )}

        {/* Even split summary */}
        {mode === "even" && (
          <div className="text-sm text-gray-500">
            ${(totalAmount / participants.length).toFixed(2)} each
            {participants.length > 0 && (
              <span className="text-xs text-gray-400 ml-2">
                ({participants.length} people)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Calculator Keypad */}
      {keypadUserId && (
        <CalculatorKeypad
          open={keypadUserId !== null}
          initialValue={splitType === "amount" ? values[keypadUserId] ?? 0 : (percentValues[keypadUserId] ?? 0)}
          onConfirm={(value) => {
            if (splitType === "amount") {
              updateAmount(keypadUserId, value);
            } else {
              updatePercent(keypadUserId, value);
            }
            setKeypadUserId(null);
          }}
          title={`Enter amount for ${participants.find(p => p.id === keypadUserId)?.name || 'participant'}`}
        />
      )}
    </>
  );
}
