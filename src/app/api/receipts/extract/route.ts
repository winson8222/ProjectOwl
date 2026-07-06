import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { ImageError, AppError } from "@/lib/errors";
import type { ExtractApiResponse } from "@/lib/schemas/receipt";

/** Maximum allowed image size: 10 MB. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Accepted image MIME types. */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/receipts/extract
 *
 * Accepts a multipart/form-data request with a single "file" field containing
 * a receipt image. Returns structured receipt data extracted by the LLM.
 *
 * Request:
 *   Content-Type: multipart/form-data
 *   Body: { file: <image blob> }
 *
 * Success (200):
 *   { success: true, data: ReceiptExtractionResult }
 *
 * Error (4xx/5xx):
 *   { success: false, error: string, code: string }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractApiResponse>> {
  try {
    // ── Parse the form data ──────────────────────────────────────────
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new ImageError(
        "Request must be multipart/form-data",
        "INVALID_REQUEST",
        400
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      throw new ImageError(
        "No file uploaded — provide a receipt image as the 'file' field",
        "MISSING_FILE",
        400
      );
    }

    // ── Validate the image ───────────────────────────────────────────
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new ImageError(
        `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, WebP, HEIC`,
        "INVALID_IMAGE_TYPE",
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ImageError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 10 MB`,
        "FILE_TOO_LARGE",
        413
      );
    }

    if (file.size === 0) {
      throw new ImageError("Uploaded file is empty", "EMPTY_FILE", 400);
    }

    // ── Read the image into a Buffer ─────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // ── Call the LLM to extract receipt data ─────────────────────────
    const client = createLLMClient();
    const result = await client.extractReceipt({
      imageBuffer,
      mimeType: file.type,
    });

    // ── Return the structured result ─────────────────────────────────
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    // ── Map errors to HTTP responses ─────────────────────────────────
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.httpStatus }
      );
    }

    // Unknown / unexpected errors
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("Unexpected error in /api/receipts/extract:", err);

    return NextResponse.json(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
