import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env/public";

export const dynamic = "force-dynamic";

async function probe(url: string, apikey: string): Promise<"ok" | "down"> {
  try {
    const res = await fetch(url, { headers: { apikey }, signal: AbortSignal.timeout(3000), cache: "no-store" });
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

/**
 * Liveness/readiness for uptime monitors. Uses only the public (publishable) key and returns no data
 * beyond component status and the deployed version.
 */
export async function GET() {
  const env = publicEnv();
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const [auth, database] = await Promise.all([
    probe(`${base}/auth/v1/health`, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    // A real (RLS-protected) table query: hosted Supabase refuses the API root to publishable keys.
    probe(`${base}/rest/v1/service_categories?select=slug&limit=1`, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  ]);
  const healthy = auth === "ok" && database === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      checks: { auth, database },
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
