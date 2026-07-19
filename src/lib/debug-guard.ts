/**
 * Server-side gate for destructive / data-dumping debug endpoints.
 *
 * The debug routes (`/api/debug`, `DELETE /api/transactions?all=true`) can wipe
 * or re-seed the whole database and dump every user + transaction. They exist
 * purely for local development and must NEVER be reachable in a deployed build,
 * where any anonymous request could otherwise nuke or exfiltrate all data.
 *
 * They are enabled only when running outside production (`npm run dev` /
 * `npm run testmode`, both `NODE_ENV=development`). An explicit
 * `ALLOW_DEBUG_ENDPOINTS=true` server env var can re-enable them in a
 * production build if you really mean to — it defaults to off.
 *
 * NOTE: this reads a **server-only** env var (not `NEXT_PUBLIC_*`), so the
 * decision can never be spoofed from the client bundle.
 */
export function debugEndpointsEnabled(): boolean {
  if (process.env.ALLOW_DEBUG_ENDPOINTS === "true") return true;
  return process.env.NODE_ENV !== "production";
}
