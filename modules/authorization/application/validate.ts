import type { z } from "zod";
import { appError, err, ok, type Result } from "@bahayplus/types/result";

/** Server-side validation entry point for every command: parses with the shared Zod contract. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): Result<z.output<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err(appError.validation(parsed.error.issues.map((i) => ({ path: i.path.map(String), message: i.message }))));
}
