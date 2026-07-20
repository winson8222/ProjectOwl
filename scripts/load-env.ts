import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader for CLI scripts. Next.js loads .env.local itself in
 * dev/build, but tsx scripts run outside Next and need this. Existing
 * process.env values always win (so CI-provided vars aren't overridden).
 */
export function loadEnv(files: string[] = [".env.local", ".env"]): void {
  for (const file of files) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
