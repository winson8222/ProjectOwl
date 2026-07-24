"use client";

import { useState, useCallback } from "react";
import UserPicker from "@/components/UserPicker";

interface Step2_InputMethodProps {
  inputMethod: "scan" | "manual";
  onMethodChange: (method: "scan" | "manual") => void;
  onNext: () => void;
  onBack: () => void;
  onScan: (data: any) => void;
  amount: number;
  setAmount: (amount: number) => void;
  date: string;
  setDate: (date: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  groups: any[];
  user: any;
}

/**
 * Step 2a (Expense): Choose input method and enter core details
 */
export default function Step2_InputMethod({
  inputMethod,
  onMethodChange,
  onNext,
  onBack,
  onScan,
  amount,
  setAmount,
  date,
  setDate,
  selectedGroupId,
  setSelectedGroupId,
  groups,
  user
}: Step2_InputMethodProps) {
  const [showScan, setShowScan] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScanUpload = async (file: File) => {
    setError(null);
    setScanFile(file);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/receipts/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        onScan(data);
      } else {
        setError(data.error || "Failed to extract receipt");
      }
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setUploading(false);
    }
  };

  if (showScan) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-4">
          Scan Receipt
        </h2>

        <div className="rounded-2xl p-8 text-center backdrop-blur-sm"
             style={{
               background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
               border: '1px solid rgba(176,176,176,0.2)'
             }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScanUpload(file);
            }}
            disabled={uploading}
            className="hidden"
            id="scan-input"
          />
          <label
            htmlFor="scan-input"
            className="cursor-pointer inline-flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-3xl">
              {uploading ? "⏳" : "📷"}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {uploading ? "Processing..." : "Tap to scan receipt"}
            </span>
          </label>
          <p className="text-xs text-gray-400 mt-2">
            Take a photo of your receipt
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        <button
          onClick={() => {
            setShowScan(false);
            setError(null);
          }}
          className="w-full px-4 py-3 text-sm font-medium text-gray-600 rounded-xl backdrop-blur-sm"
          style={{
            border: '1px solid rgba(176,176,176,0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.2) 100%)'
          }}
        >
          ← Back to method selection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        How would you like to add this expense?
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Scan Card */}
        <button
          onClick={() => {
            onMethodChange("scan");
            setShowScan(true);
          }}
          className="p-6 rounded-2xl backdrop-blur-sm transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
            border: '1px solid rgba(176,176,176,0.2)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
          }}
        >
          <div className="text-4xl mb-3">📷</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Scan Receipt</h3>
          <p className="text-sm text-gray-500">Auto-extract items</p>
        </button>

        {/* Manual Card */}
        <button
          onClick={() => {
            onMethodChange("manual");
            setTimeout(() => onNext(), 200);
          }}
          className="p-6 rounded-2xl backdrop-blur-sm transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
            border: '1px solid rgba(176,176,176,0.2)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
          }}
        >
          <div className="text-4xl mb-3">⌨️</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Enter Manually</h3>
          <p className="text-sm text-gray-500">Type the details</p>
        </button>
      </div>
    </div>
  );
}
