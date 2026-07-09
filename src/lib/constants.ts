/**
 * Centralized error codes and messages for the application.
 *
 * All API routes and frontend validation should reference these constants
 * instead of hardcoding strings. This makes it easy to update error messages
 * or add i18n later.
 *
 * Usage:
 *   import { ERRORS } from "@/lib/constants";
 *   throw new ImageError(ERRORS.FILE.MISSING, "MISSING_FILE", 400);
 */

// ── API Error Codes ─────────────────────────────────────────────────
export const CODES = {
  // Generic
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  MISSING_FIELDS: "MISSING_FIELDS",
  MISSING_ID: "MISSING_ID",

  // Users
  MISSING_USER_ID: "MISSING_USER_ID",
  MISSING_NAME_EMAIL: "MISSING_NAME_EMAIL",

  // File upload
  INVALID_REQUEST: "INVALID_REQUEST",
  MISSING_FILE: "MISSING_FILE",
  INVALID_IMAGE_TYPE: "INVALID_IMAGE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  EMPTY_FILE: "EMPTY_FILE",

  // Transactions
  NO_ITEMS: "NO_ITEMS",
  UNASSIGNED_ITEM: "UNASSIGNED_ITEM",
  SPLIT_MISMATCH: "SPLIT_MISMATCH",

  // Settlements
  MISSING_SETTLEMENT_ID: "MISSING_SETTLEMENT_ID",

  // LLM
  LLM_FAILED: "LLM_FAILED",
  LLM_INVALID_RESPONSE: "LLM_INVALID_RESPONSE",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;

// ── User-Facing Error Messages ──────────────────────────────────────
export const ERROR_MESSAGES = {
  // Generic / fallback
  UNKNOWN: "An unexpected error occurred",
  FAILED_TO_SAVE: "Failed to save. Please try again.",
  FAILED_TO_CONNECT: "Failed to connect to the server. Is it running?",

  // Users
  USER_NOT_FOUND: "User not found",
  USER_ID_REQUIRED: "userId is required",
  NAME_EMAIL_REQUIRED: "Name and email are required",
  SESSION_REQUIRED: "Please select a user from the home page first",

  // File upload
  INVALID_REQUEST_BODY: "Request must be multipart/form-data",
  MISSING_FILE_UPLOAD: "No file uploaded — provide a receipt image as the 'file' field",
  INVALID_IMAGE_TYPE: (type: string) =>
    `Unsupported file type: ${type}. Accepted: JPEG, PNG, WebP, HEIC`,
  FILE_TOO_LARGE: (size: string) =>
    `File too large (${size}). Max: 10 MB`,
  EMPTY_FILE_UPLOAD: "Uploaded file is empty",

  // Transactions
  TX_MISSING_FIELDS: "Missing required fields: title, totalAmount, paidByUserId, transactionDate",
  TX_NO_ITEMS: "Transaction must have at least one item",
  TX_UNASSIGNED_ITEM: (name: string) => `Item "${name}" has no assignments`,
  TX_NOT_FOUND: "Transaction not found",
  TX_ID_REQUIRED: "Transaction id is required",
  TX_SPLIT_MISMATCH: (assigned: string, price: string) =>
    `Split amounts ($${assigned}) don't equal total ($${price})`,
  TX_ITEM_SPLIT_MISMATCH: (name: string, assigned: string, price: string) =>
    `Item "${name}" assignments ($${assigned}) don't sum to its price ($${price})`,

  // Settlements
  SETTLEMENT_ID_REQUIRED: "settlementId is required",
  SETTLEMENT_NOT_FOUND: "Settlement not found",

  // LLM
  LLM_GENERIC: (status: number, detail: string) =>
    `Gemini API returned ${status}: ${detail}`,
  LLM_QUOTA: "You've exceeded the Gemini API daily quota. Enable billing or wait for reset.",
  LLM_NO_CONTENT: (reason: string) =>
    `Gemini returned no content (${reason}). The image may have been blocked by safety filters.`,
  LLM_INVALID_JSON: (preview: string) =>
    `Gemini response was not valid JSON: ${preview}`,
} as const;

// ── Frontend Validation Messages ────────────────────────────────────
export const VALIDATION = {
  SPLIT_NOT_BALANCED: (remaining: number) =>
    remaining > 0
      ? `Remaining to allocate: $${remaining.toFixed(2)}`
      : `Over-allocated by: $${Math.abs(remaining).toFixed(2)}`,

  NO_PARTICIPANTS: "Select at least one participant",
  NO_ITEMS: "Add at least one item to the transaction",
  EMPTY_TITLE: "Enter a description for the transaction",
  INVALID_AMOUNT: "Enter a valid total amount greater than $0",
} as const;

// ── API Response Helper ─────────────────────────────────────────────
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

/** Build a standardized error response object. */
export function apiError(message: string, code: string): ApiErrorResponse {
  return { success: false, error: message, code };
}
