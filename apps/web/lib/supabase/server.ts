import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "@bahayplus/types/database";

/**
 * User-scoped Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the publishable key + the user's session cookie, so Row Level Security applies.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: it marks the route dynamic before any env access happens at build time.
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component where cookies are read-only; proxy.ts refreshes the session.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
