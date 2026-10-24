import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@bahayplus/types/database";

export type Db = SupabaseClient<Database>;

/**
 * Explicit per-request context passed to every application service. `db` is a user-scoped
 * client, so Row Level Security applies to everything a service does with it.
 */
export type ServiceContext = {
  db: Db;
  userId: string;
  requestId?: string;
};
