/** Return the current datetime as a local-time ISO string (no timezone suffix, sorts lexicographically).
 *  Matches SQLite's CURRENT_TIMESTAMP format so string sorts work across both. */
export function localTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}
