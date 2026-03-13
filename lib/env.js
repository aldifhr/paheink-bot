import { readFileSync } from "node:fs";
import path from "node:path";

export function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");

  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const index = trimmed.indexOf("=");
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    return;
  }
}
