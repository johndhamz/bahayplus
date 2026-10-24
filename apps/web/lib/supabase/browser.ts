"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "@bahayplus/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client — for realtime and signed uploads only. Business writes go through the server. */
export function getSupabaseBrowserClient() {
  const env = publicEnv();
  client ??= createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
