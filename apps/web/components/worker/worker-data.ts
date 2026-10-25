import "server-only";
import { listWorkOrders } from "@bahayplus/modules/bookings";
import { getMyContexts, requireServiceContext } from "@/lib/auth/context";

/** Jobs assigned to the signed-in worker across all their organizations (RLS + active assignment). */
export async function myJobs(filter: { from?: string; to?: string } = {}) {
  const ctx = await requireServiceContext("/worker");
  const [jobs, contexts] = await Promise.all([
    listWorkOrders(ctx, { assignedToMe: true }, { ...filter, limit: 200 }),
    getMyContexts(),
  ]);
  const orgName = new Map(contexts.filter((c) => c.kind === "organization" && c.id).map((c) => [c.id!, c.name]));
  return { ctx, jobs: jobs.ok ? jobs.value : null, orgName };
}

export const manilaDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(iso));
