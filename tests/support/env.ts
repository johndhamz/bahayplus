import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Loads apps/web/.env.local (if present) without overriding variables already set (e.g. in CI). */
export function loadLocalEnv(): void {
  try {
    const text = readFileSync(resolve(import.meta.dirname, "../../apps/web/.env.local"), "utf8");
    for (const line of text.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
    }
  } catch {
    /* no local env file */
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} is required for integration tests. Run \`npm run db:start\` and configure apps/web/.env.local.`,
    );
  return value;
}
