"use client";

import { useState, useCallback } from "react";
import ReceiptUploader from "@/components/ReceiptUploader";
import LoadingOverlay from "@/components/LoadingOverlay";
import ReceiptResult from "@/components/ReceiptResult";
import ErrorAlert from "@/components/ErrorAlert";
import type {
  ReceiptExtractionResult,
  ExtractApiResponse,
} from "@/lib/schemas/receipt";

type PageStatus = "idle" | "uploading" | "success" | "error";

/**
 * Scan page — upload a receipt, send it to the API, and display the
 * extracted items and totals.
 *
 * State machine: idle → uploading → success | error → idle (retry)
 */
export default function ScanPage() {
  const [status, setStatus] = useState<PageStatus>("idle");
  const [result, setResult] = useState<ReceiptExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setStatus("uploading");
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/receipts/extract", {
        method: "POST",
        body: formData,
      });

      const json: ExtractApiResponse = await response.json();

      if (!json.success) {
        setError(json.error || "Unknown error");
        setStatus("error");
        return;
      }

      setResult(json.data);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to connect to the server. Is the server running?";
      setError(message);
      setStatus("error");
    }
  }, []);

  const handleRetry = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-md mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Scan Receipt</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a photo of your receipt and we&apos;ll extract the items for you.
        </p>
      </div>

      {/* Upload area (shown in idle and error states) */}
      {(status === "idle" || status === "error") && (
        <ReceiptUploader onUpload={handleUpload} disabled={false} />
      )}

      {/* Error state */}
      {status === "error" && error && (
        <div className="mt-6 w-full">
          <ErrorAlert message={error} onRetry={handleRetry} />
        </div>
      )}

      {/* Success state */}
      {status === "success" && result && (
        <div className="w-full space-y-4">
          <ReceiptResult data={result} />
          <button
            onClick={handleRetry}
            className="w-full max-w-md mx-auto block px-4 py-2.5 text-sm font-medium
                       text-[var(--primary)] border border-[var(--primary)] rounded-lg
                       hover:bg-blue-50 transition-colors"
          >
            Scan another receipt
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {status === "uploading" && <LoadingOverlay />}
    </main>
  );
}
