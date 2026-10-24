import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import type { Database } from "@bahayplus/types/database";

/**
 * Service-role client. BYPASSES Row Level Security.
 * Allowed only in: background jobs, audited platform-admin operations, and test setup.
 * Never import from client components or use for request-scoped user reads.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
