"use client";

import { useState, useCallback } from "react";
import UserPicker from "@/components/UserPicker";
import { ScanDiagram, ManualDiagram } from "./TypeDiagrams";
import ScanLoader from "@/components/ScanLoader";
import { tapLight } from "@/lib/haptics";

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
        setError(
          data.error ||
            "Couldn't read that receipt. Try a straighter photo with the whole receipt in frame."
        );
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  // Full-screen takeover while the receipt is being read, rather than a
  // spinner inside the card. Purely presentational — same `uploading` flag.
  if (uploading) {
    return <ScanLoader />;
  }

  if (showScan) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-title2 font-bold text-ink">ItreAI</h2>
          <p className="text-subhead text-ink-muted mt-1">
            Get the whole receipt in frame, straight on
          </p>
        </div>

        <div className="rounded-2xl p-8 text-center backdrop-blur-sm"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-hairline)'
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
            <span
              className="w-20 h-20 rounded-full flex items-center justify-center text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-blueberry-600) 0%, var(--color-blueberry-700) 100%)",
              }}
            >
              <ScanDiagram />
            </span>
            <span className="text-body font-medium text-ink">Take a photo</span>
          </label>
          <p className="text-footnote text-ink-muted mt-2">
            Or pick one from your camera roll
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
            ⚠ {error}
          </div>
        )}

        <button
          onClick={() => {
            setShowScan(false);
            setError(null);
          }}
          className="w-full px-4 py-3 text-sm font-medium text-ink-muted rounded-xl backdrop-blur-sm"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface)'
          }}
        >
          ← Choose a different way
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-title2 font-bold text-ink mb-5">How do you want to add it?</h2>

      {/* ItreAI leads and carries the accent — it's the path we want people on,
          and the one that justifies the app existing. */}
      <button
        onClick={() => {
          tapLight();
          onMethodChange("scan");
          setShowScan(true);
        }}
        className="pressable w-full flex items-center gap-4 p-4 rounded-[14px] text-left"
        style={{
          background:
            "linear-gradient(135deg, var(--color-blueberry-600) 0%, var(--color-blueberry-700) 100%)",
          border: "1px solid var(--color-blueberry-700)",
          boxShadow:
            "0 2px 6px color-mix(in srgb, var(--color-blueberry-900) 22%, transparent)",
        }}
      >
        <span
          className="shrink-0 flex items-center justify-center rounded-[10px] text-white"
          style={{ width: 60, height: 60, background: "rgba(255,255,255,0.14)" }}
        >
          <ScanDiagram />
        </span>
        <span className="min-w-0">
          <span className="flex items-baseline gap-1.5">
            <span className="text-headline font-semibold text-white">ItreAI</span>
            <span
              className="text-caption font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
            >
              Scan
            </span>
          </span>
          <span
            className="block text-subhead mt-0.5"
            style={{ color: "rgba(255,255,255,0.82)" }}
          >
            Photograph the receipt — every item and price is read for you
          </span>
        </span>
      </button>

      <button
        onClick={() => {
          tapLight();
          onMethodChange("manual");
          setTimeout(() => onNext(), 200);
        }}
        className="pressable w-full flex items-center gap-4 p-4 rounded-[14px] text-left"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-hairline)",
          boxShadow:
            "0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)",
        }}
      >
        <span
          className="shrink-0 flex items-center justify-center rounded-[10px]"
          style={{
            width: 60,
            height: 60,
            background: "var(--color-surface-raised)",
            color: "var(--color-blueberry-600)",
          }}
        >
          <ManualDiagram />
        </span>
        <span className="min-w-0">
          <span className="block text-headline font-semibold text-ink">
            Enter it myself
          </span>
          <span className="block text-subhead text-ink-muted mt-0.5">
            Type the title and total by hand
          </span>
        </span>
      </button>
    </div>
  );
}
