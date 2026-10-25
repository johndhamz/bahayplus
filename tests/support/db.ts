import pg from "pg";

/**
 * Direct Postgres access for TEST SETUP ONLY (e.g. clearing simulated job-run keys).
 * Uses the local Supabase DB URL; never used by application code.
 */
export async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54722/postgres",
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Forget simulated daily job runs so a test can exercise them deterministically. */
export async function clearJobRuns(runKeys: string[]): Promise<void> {
  await withDb((c) =>
    c.query("delete from private.job_runs where job_name = 'daily_bills' and run_key = any($1)", [runKeys]),
  );
}
