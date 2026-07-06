/**
 * AppError — base error class for the application.
 * Carries structured info for API responses.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 500,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * LLMError — the LLM provider returned an error or gave a bad response.
 */
export class LLMError extends AppError {
  constructor(message: string, retryable: boolean = false) {
    super(message, "LLM_FAILED", 502, retryable);
    this.name = "LLMError";
  }
}

/**
 * ValidationError — the LLM response did not match the expected schema.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_FAILED", 502, false);
    this.name = "ValidationError";
  }
}

/**
 * ImageError — the uploaded file is missing, too large, or the wrong type.
 */
export class ImageError extends AppError {
  constructor(message: string, code: string, httpStatus: number) {
    super(message, code, httpStatus, false);
    this.name = "ImageError";
  }
}
