import { createOrganization } from "@bahayplus/modules/organizations";
import { adminClient, type TestUser } from "./supabase";

/** Test setup: a published, verified provider with one service (via the service role). */
export async function createListedProvider(
  owner: TestUser,
  opts: { name: string; capacity?: number; bookNow?: boolean; durationMinutes?: number; priceCentavos?: number | null },
) {
  const slug = `${opts.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`.slice(0, 60);
  const created = await createOrganization(owner.ctx, { kind: "service_provider", name: opts.name, slug });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  const orgId = created.value.organizationId;
  const admin = adminClient();
  await admin
    .from("provider_profiles")
    .update({
      is_published: true,
      accepts_book_now: opts.bookNow ?? true,
      accepts_quote_requests: true,
      availability_status: "available",
      concurrent_capacity: opts.capacity ?? 1,
    })
    .eq("organization_id", orgId);
  const { data: category } = await admin.from("service_categories").select("id").eq("slug", "plumbing").single();
  const price = opts.priceCentavos === undefined ? 150_000 : opts.priceCentavos;
  const { data: service } = await admin
    .from("provider_services")
    .insert({
      organization_id: orgId,
      category_id: category!.id,
      title: "Leak repair",
      pricing_model: price === null ? "quote_only" : "fixed",
      price_centavos: price,
      duration_minutes: opts.durationMinutes ?? 120,
      allows_book_now: (opts.bookNow ?? true) && price !== null,
      allows_quote: true,
    })
    .select("id")
    .single();
  const expires = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const { data: request } = await admin
    .from("verification_requests")
    .insert({ organization_id: orgId, status: "approved", decided_at: new Date().toISOString(), expires_on: expires })
    .select("id")
    .single();
  await admin.from("verification_items").insert({
    request_id: request!.id,
    organization_id: orgId,
    item_type: "business_registration",
    status: "verified",
  });
  return { orgId, serviceId: service!.id as string, slug };
}

/** A future Manila wall-clock time as ISO UTC, aligned to the hour. */
export function futureSlot(daysAhead: number, hourManila: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
  return new Date(`${ymd}T${String(hourManila).padStart(2, "0")}:00:00+08:00`).toISOString();
}

/** The same instant in the "YYYY-MM-DDTHH:MM" Manila format used by forms. */
export function toManilaLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
