import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";
import type { ExtractApiResponse } from "@/lib/schemas/receipt";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/receipts/extract
 * Accepts a multipart/form-data request with a single "file" field.
 * Returns structured receipt data extracted by the LLM.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractApiResponse | ApiErrorResponse>> {
  try {
    // Each scan costs LLM quota — signed-in users only.
    if (!(await getCurrentUser())) return unauthorized();

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVALID_REQUEST_BODY, CODES.INVALID_REQUEST),
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.MISSING_FILE_UPLOAD, CODES.MISSING_FILE),
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVALID_IMAGE_TYPE(file.type), CODES.INVALID_IMAGE_TYPE),
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(
          ERROR_MESSAGES.FILE_TOO_LARGE(`${(file.size / 1024 / 1024).toFixed(1)} MB`),
          CODES.FILE_TOO_LARGE
        ),
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.EMPTY_FILE_UPLOAD, CODES.EMPTY_FILE),
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const client = createLLMClient();
    const result = await client.extractReceipt({
      imageBuffer,
      mimeType: file.type,
    });

    return NextResponse.json({ success: true, data: result } as ExtractApiResponse, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(err.message, err.code),
        { status: err.httpStatus }
      );
    }

    console.error("Unexpected error in /api/receipts/extract:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
