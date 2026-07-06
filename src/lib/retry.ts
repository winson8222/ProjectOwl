import { AppError } from "./errors";

export interface RetryOptions {
  maxRetries: number;
  /** Base delay in ms — each retry doubles it + jitter. */
  baseDelayMs: number;
}

/**
 * Error substrings that indicate a transient server-side issue.
 * Retrying after a short delay *may* succeed.
 */
const TRANSIENT_ERRORS = ["503", "UNAVAILABLE"];

/**
 * Error substrings that indicate a per-minute rate limit hit (not daily quota).
 * These *may* clear after waiting long enough (free tier: ~13s).
 */
const RATE_LIMIT_ERRORS = ["429", "RESOURCE_EXHAUSTED", "requests per minute"];

/**
 * Error substrings that indicate a daily quota exhaustion.
 * Retrying will NEVER help — quota resets on a daily cycle (~24h from first
 * request of the day). We detect these to fail fast with a clear message.
 */
const QUOTA_ERRORS = [
  "quota",
  "exceeded your current quota",
  "daily limit",
];

function isQuotaError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return QUOTA_ERRORS.some((pattern) => msg.includes(pattern));
}

function isTransientError(err: unknown): boolean {
  const msg = String(err);
  return TRANSIENT_ERRORS.some((pattern) => msg.includes(pattern));
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err);
  return RATE_LIMIT_ERRORS.some((pattern) => msg.includes(pattern));
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    (err.message.includes("fetch") || err.message.includes("network"))
  );
}

function shouldRetry(err: unknown): boolean {
  // Daily quota — never retry, fail fast so the user sees the real message
  if (isQuotaError(err)) {
    return false;
  }
  // Per-minute rate limit — retry with long delays
  if (isRateLimitError(err)) {
    return true;
  }
  // Transient server errors — retry
  if (isTransientError(err)) {
    return true;
  }
  // AppError with explicit retryable flag
  if (err instanceof AppError && err.retryable) {
    return true;
  }
  // Network / connectivity failures — retry
  if (isNetworkError(err)) {
    return true;
  }
  return false;
}

/**
 * Wraps an async function with backoff retry logic.
 *
 * - **Daily quota errors (429 "quota")**: NOT retried — fail immediately
 *   with the original error so the user sees the real message.
 * - **Per-minute rate limits (429 "rate limit")**: retried with ~13s delays
 *   to stay under free tier limits (5 req/min).
 * - **Transient server errors (503 / UNAVAILABLE)**: retried with shorter
 *   exponential backoff.
 * - **Network errors**: retried with short backoff.
 * - All other errors propagate immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 5, baseDelayMs: 1000 }
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!shouldRetry(err)) {
        throw err;
      }

      if (attempt < options.maxRetries) {
        let delay: number;

        if (isRateLimitError(err)) {
          // Per-minute rate limit: wait ~13s (free tier: 5 req/min)
          delay = 13000 + Math.random() * 2000;
        } else {
          // Server error or network: exponential backoff, clamped at 8s
          delay = Math.min(
            options.baseDelayMs * Math.pow(2, attempt),
            8000
          );
        }

        const jitter = Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError;
}
