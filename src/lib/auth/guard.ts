import { NextResponse } from "next/server";
import { CODES, ERROR_MESSAGES, apiError, type ApiErrorResponse } from "@/lib/constants";

/** 401 response for routes when getCurrentUser() returns null. */
export function unauthorized(): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    apiError(ERROR_MESSAGES.NOT_SIGNED_IN, CODES.UNAUTHORIZED),
    { status: 401 }
  );
}

/** 403 response for authenticated users acting outside their rights. */
export function forbidden(): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    apiError(ERROR_MESSAGES.FORBIDDEN, CODES.FORBIDDEN),
    { status: 403 }
  );
}
