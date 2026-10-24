import { z } from "zod";

/** Variables safe to expose to the browser (NEXT_PUBLIC_*). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

/** Server-only variables. Never prefix these with NEXT_PUBLIC_. */
export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, "SUPABASE_SECRET_KEY is required on the server"),
  JOB_RUNNER_SECRET: z.string().min(32, "JOB_RUNNER_SECRET must be at least 32 characters").optional(),
  APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(scope: string, issues: z.core.$ZodIssue[]) {
    const lines = issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    super(`Invalid ${scope} environment variables:\n${lines.join("\n")}\nSee .env.example.`);
    this.name = "EnvValidationError";
  }
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError("public", result.error.issues);
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError("server", result.error.issues);
  for (const key of Object.keys(source)) {
    if (key.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE/i.test(key)) {
      throw new EnvValidationError("server", [
        { code: "custom", path: [key], message: "secrets must not use the NEXT_PUBLIC_ prefix", input: undefined },
      ]);
    }
  }
  return result.data;
}
