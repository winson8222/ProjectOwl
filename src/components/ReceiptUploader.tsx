"use client";

import { useCallback, useRef, useState } from "react";

interface ReceiptUploaderProps {
  onUpload: (file: File) => void;
  disabled: boolean;
}

/**
 * Drag-and-drop file upload zone for receipt images.
 * Accepts JPEG, PNG, WebP, and HEIC images.
 */
export default function ReceiptUploader({
  onUpload,
  disabled,
}: ReceiptUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      setClientError(null);

      if (!file) return;

      // Client-side validation before uploading
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ];
      if (!allowedTypes.includes(file.type)) {
        setClientError(
          `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, WebP, HEIC`
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setClientError(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 10 MB`
        );
        return;
      }

      onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer.files[0] ?? null);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={disabled ? undefined : handleClick}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? "border-[var(--primary)] bg-blue-50"
              : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-gray-50"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="text-4xl mb-3">📄</div>
        <p className="text-sm font-medium text-gray-700 mb-1">
          Drop a receipt photo here
        </p>
        <p className="text-xs text-gray-500">or tap to browse</p>
        <p className="text-xs text-gray-400 mt-2">
          JPEG, PNG, WebP — up to 10 MB
        </p>
      </div>

      {clientError && (
        <p className="mt-2 text-sm text-[var(--danger)]">{clientError}</p>
      )}
    </div>
  );
}
