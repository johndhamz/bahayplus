import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestBooking } from "@bahayplus/modules/bookings";
import { createHousehold } from "@bahayplus/modules/households";
import { acceptOrganizationInvitation, inviteOrganizationMember } from "@bahayplus/modules/organizations";
import {
  applyVerifiedEvent,
  cancelPayment,
  createSettlement,
  getPayment,
  listPaymentEvents,
  listPayments,
  listSettlements,
  requestRefund,
  runReconciliation,
  SANDBOX_SIGNATURE_HEADER,
  SandboxPaymentProvider,
  setCommissionRate,
  startPayment,
} from "@bahayplus/modules/payments";
import { createProperty } from "@bahayplus/modules/properties";
import { manilaDateOf } from "@bahayplus/types/dates";
import { withDb } from "../support/db";
import { createListedProvider, futureSlot, toManilaLocal } from "../support/marketplace";
import { adminClient, cleanupTestUsers, createTestUser, verifySecondFactor, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}
const reasonOf = (r: { ok: boolean; error?: { reason?: string; code?: string } }) =>
  r.ok ? "ok" : (r.error?.reason ?? r.error?.code);

const sandbox = new SandboxPaymentProvider({
  webhookSecret: "test-webhook-secret-0123456789abcdef0123",
  siteUrl: "http://localhost:3000",
});
let seq = 0;

/** Signs, verifies and applies a provider event exactly like the webhook endpoint does. */
async function deliver(
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded" | "refund.failed",
  externalReference: string,
  amountCentavos: number,
  id = `evt_test_${Date.now()}_${seq++}`,
) {
  const { body, signature } = sandbox.buildWebhook({ id, type, externalReference, amountCentavos });
  const event = sandbox.parseWebhook(body, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signature }));
  if ("error" in event) throw new Error(event.error);
  return unwrap(await applyVerifiedEvent(adminClient(), "sandbox", event));
}

let customer: TestUser;
let rivalCustomer: TestUser;
let providerOwner: TestUser;
let providerStaff: TestUser;
let rivalProvider: TestUser;
let finance: TestUser;
let support: TestUser;
let household: string;
let property: string;
let rivalHousehold: string;
let provider: { orgId: string; serviceId: string };

async function confirmedBooking(day: number) {
  return unwrap(
    await requestBooking(customer.ctx, {
      householdId: household,
      serviceId: provider.serviceId,
      propertyId: property,
      start: toManilaLocal(futureSlot(day, 9 + (day % 6))),
      idempotencyKey: crypto.randomUUID(),
    }),
  ).bookingId;
}

async function paidIntent(day: number) {
  const bookingId = await confirmedBooking(day);
  const { paymentIntentId } = unwrap(
    await startPayment(
      customer.ctx,
      adminClient(),
      sandbox,
      { bookingId, idempotencyKey: crypto.randomUUID() },
      "/app",
    ),
  );
  const pi = unwrap(await getPayment(customer.ctx, paymentIntentId));
  expect(await deliver("payment.succeeded", pi.externalReference!, pi.amountCentavos)).toBe("applied");
  return { bookingId, intent: unwrap(await getPayment(customer.ctx, paymentIntentId)) };
}

async function refund(user: TestUser, intentId: string, amount: number, key = crypto.randomUUID()) {
  return requestRefund(user.ctx, adminClient(), sandbox, {
    paymentIntentId: intentId,
    amountCentavos: amount,
    reason: "Customer request",
    idempotencyKey: key,
  });
}

async function refundRef(refundId: string) {
  const { data } = await adminClient().from("refunds").select("external_reference").eq("id", refundId).single();
  return data!.external_reference as string;
}

beforeAll(async () => {
  [customer, rivalCustomer, providerOwner, providerStaff, rivalProvider, finance, support] = (await Promise.all(
    ["pay-customer", "pay-rival-cust", "pay-provider", "pay-staff", "pay-rival-prov", "pay-finance", "pay-support"].map(
      (l) => createTestUser(l),
    ),
  )) as [TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser];
  provider = await createListedProvider(providerOwner, {
    name: "Pay Plumbing",
    capacity: 20,
    durationMinutes: 60,
    priceCentavos: 150_000,
  });
  await createListedProvider(rivalProvider, { name: "Pay Rival" });
  const inv = unwrap(
    await inviteOrganizationMember(providerOwner.ctx, {
      organizationId: provider.orgId,
      email: providerStaff.email,
      role: "staff",
    }),
  );
  unwrap(await acceptOrganizationInvitation(providerStaff.ctx, { token: inv.token }));
  household = unwrap(await createHousehold(customer.ctx, { name: "Pay household" })).householdId;
  property = unwrap(
    await createProperty(customer.ctx, {
      householdId: household,
      name: "Home",
      propertyType: "house",
      cityMunicipality: "Pasig",
      province: "Metro Manila",
    }),
  ).propertyId;
  rivalHousehold = unwrap(await createHousehold(rivalCustomer.ctx, { name: "Rival pay household" })).householdId;
  await withDb(async (c) => {
    await c.query(
      "insert into public.platform_admins (user_id, role_id) select $1, id from public.roles where scope = 'platform' and key = 'operations'",
      [finance.id],
    );
    await c.query(
      "insert into public.platform_admins (user_id, role_id) select $1, id from public.roles where scope = 'platform' and key = 'support'",
      [support.id],
    );
  });
  await Promise.all([verifySecondFactor(finance), verifySecondFactor(support)]);
});
afterAll(async () => {
  await withDb((c) =>
    c.query("delete from public.platform_admins where user_id = any($1)", [[finance.id, support.id]]),
  );
  await cleanupTestUsers();
});

describe("intents: amounts and success come only from the server", () => {
  it("creates an intent for the agreed price; repeated starts reuse it", async () => {
    const bookingId = await confirmedBooking(3);
    const key = crypto.randomUUID();
    const a = unwrap(
      await startPayment(customer.ctx, adminClient(), sandbox, { bookingId, idempotencyKey: key }, "/app"),
    );
    const b = unwrap(
      await startPayment(customer.ctx, adminClient(), sandbox, { bookingId, idempotencyKey: key }, "/app"),
    );
    const c = unwrap(
      await startPayment(
        customer.ctx,
        adminClient(),
        sandbox,
        { bookingId, idempotencyKey: crypto.randomUUID() },
        "/app",
      ),
    );
    expect(new Set([a.paymentIntentId, b.paymentIntentId, c.paymentIntentId]).size).toBe(1);
    const pi = unwrap(await getPayment(customer.ctx, a.paymentIntentId));
    expect(pi).toMatchObject({ amountCentavos: 150_000, status: "processing", provider: "sandbox" });
    expect(pi.externalReference).toMatch(/^sbx_pi_/);
  });

  it("users can't mark payments paid, attach references or apply events", async () => {
    const bookingId = await confirmedBooking(4);
    const { paymentIntentId } = unwrap(
      await startPayment(
        customer.ctx,
        adminClient(),
        sandbox,
        { bookingId, idempotencyKey: crypto.randomUUID() },
        "/app",
      ),
    );
    const direct = await customer.client
      .from("payment_intents")
      .update({ status: "succeeded" })
      .eq("id", paymentIntentId)
      .select("id");
    expect(direct.error).not.toBeNull();
    const rpc = await customer.client.rpc("apply_payment_event", {
      p_provider: "sandbox",
      p_event_id: "forged",
      p_event_type: "payment.succeeded",
      p_external_reference: "x",
      p_amount_centavos: 1,
      p_currency: "PHP",
      p_signed_at: new Date().toISOString(),
      p_payload: {},
    });
    expect(rpc.error).not.toBeNull();
    const attach = await providerOwner.client.rpc("attach_payment_reference", {
      p_intent: paymentIntentId,
      p_external_reference: "evil",
      p_checkout_url: "/x",
    });
    expect(attach.error).not.toBeNull();
    expect(unwrap(await getPayment(customer.ctx, paymentIntentId)).status).toBe("processing");
  });
});

describe("webhook verification and replay protection", () => {
  it("rejects missing, malformed, altered and stale signatures", () => {
    const { body, signature } = sandbox.buildWebhook({
      id: "evt_sig",
      type: "payment.succeeded",
      externalReference: "sbx_pi_x",
      amountCentavos: 100,
    });
    const h = (sig?: string) => new Headers(sig ? { [SANDBOX_SIGNATURE_HEADER]: sig } : {});
    expect(sandbox.parseWebhook(body, h())).toEqual({ error: "missing" });
    expect(sandbox.parseWebhook(body, h("v1=abc"))).toEqual({ error: "malformed" });
    expect(sandbox.parseWebhook(body.replace('"amount":100', '"amount":999999'), h(signature))).toEqual({
      error: "mismatch",
    });
    const stale = sandbox.buildWebhook(
      { id: "evt_old", type: "payment.succeeded", externalReference: "sbx_pi_x", amountCentavos: 100 },
      Math.floor(Date.now() / 1000) - 3600,
    );
    expect(sandbox.parseWebhook(stale.body, h(stale.signature))).toEqual({ error: "expired" });
    const otherSecret = new SandboxPaymentProvider({
      webhookSecret: "a-different-secret-0123456789abcdefgh",
      siteUrl: "http://x",
    });
    const forged = otherSecret.buildWebhook({
      id: "evt_forged",
      type: "payment.succeeded",
      externalReference: "sbx_pi_x",
      amountCentavos: 100,
    });
    expect(sandbox.parseWebhook(forged.body, h(forged.signature))).toEqual({ error: "mismatch" });
  });

  it("duplicate deliveries and replays of an event id apply once", async () => {
    const bookingId = await confirmedBooking(5);
    const { paymentIntentId } = unwrap(
      await startPayment(
        customer.ctx,
        adminClient(),
        sandbox,
        { bookingId, idempotencyKey: crypto.randomUUID() },
        "/app",
      ),
    );
    const pi = unwrap(await getPayment(customer.ctx, paymentIntentId));
    const id = `evt_dup_${paymentIntentId}`;
    expect(await deliver("payment.succeeded", pi.externalReference!, pi.amountCentavos, id)).toBe("applied");
    expect(await deliver("payment.succeeded", pi.externalReference!, pi.amountCentavos, id)).toBe("duplicate");
    // A replay of the same event id with a fresh, valid signature is still a duplicate.
    expect(await deliver("payment.failed", pi.externalReference!, pi.amountCentavos, id)).toBe("duplicate");
    const events = unwrap(await listPaymentEvents(customer.ctx, paymentIntentId)).filter(
      (e) => e.eventType === "payment.succeeded",
    );
    expect(events).toHaveLength(1);
    expect(unwrap(await getPayment(customer.ctx, paymentIntentId)).status).toBe("succeeded");
  });
});

describe("payment states", () => {
  it("concurrent success and failure events settle on success, recorded once", async () => {
    const bookingId = await confirmedBooking(6);
    const { paymentIntentId } = unwrap(
      await startPayment(
        customer.ctx,
        adminClient(),
        sandbox,
        { bookingId, idempotencyKey: crypto.randomUUID() },
        "/app",
      ),
    );
    const pi = unwrap(await getPayment(customer.ctx, paymentIntentId));
    const outcomes = await Promise.all([
      deliver("payment.failed", pi.externalReference!, pi.amountCentavos),
      deliver("payment.succeeded", pi.externalReference!, pi.amountCentavos),
      deliver("payment.succeeded", pi.externalReference!, pi.amountCentavos),
    ]);
    expect(outcomes.filter((o) => o === "applied").length).toBeGreaterThanOrEqual(1);
    const final = unwrap(await getPayment(customer.ctx, paymentIntentId));
    expect(final.status).toBe("succeeded");
    expect(final.commissionCentavos).toBe(15_000);
    expect(
      unwrap(await listPaymentEvents(customer.ctx, paymentIntentId)).filter((e) => e.eventType === "payment.succeeded"),
    ).toHaveLength(1);
  });

  it("failed payments record the reason and allow a new attempt; mismatches and unknown references are ignored", async () => {
    const bookingId = await confirmedBooking(7);
    const first = unwrap(
      await startPayment(
        customer.ctx,
        adminClient(),
        sandbox,
        { bookingId, idempotencyKey: crypto.randomUUID() },
        "/app",
      ),
    );
    const pi = unwrap(await getPayment(customer.ctx, first.paymentIntentId));
    expect(await deliver("payment.succeeded", pi.externalReference!, pi.amountCentavos - 1)).toBe(
      "ignored:amount_mismatch",
    );
    expect(unwrap(await getPayment(customer.ctx, pi.id)).status).toBe("processing");
    expect(await deliver("payment.failed", pi.externalReference!, pi.amountCentavos)).toBe("applied");
    const failed = unwrap(await getPayment(customer.ctx, pi.id));
    expect(failed.status).toBe("failed");
    expect(failed.failureMessage).toBeTruthy();
    expect(await deliver("payment.succeeded", "sbx_pi_doesnotexist", 100)).toBe("ignored:unknown_reference");
    const usd = await adminClient().rpc("apply_payment_event", {
      p_provider: "sandbox",
      p_event_id: `evt_usd_${pi.id}`,
      p_event_type: "payment.succeeded",
      p_external_reference: pi.externalReference!,
      p_amount_centavos: pi.amountCentavos,
      p_currency: "USD",
      p_signed_at: new Date().toISOString(),
      p_payload: {},
    });
    expect(usd.data).toBe("ignored:currency_mismatch");
    const retry = unwrap(
      await startPayment(
        customer.ctx,
        adminClient(),
        sandbox,
        { bookingId, idempotencyKey: crypto.randomUUID() },
        "/app",
      ),
    );
    expect(retry.paymentIntentId).not.toBe(pi.id);
    expect(reasonOf(await cancelPayment(customer.ctx, { paymentIntentId: retry.paymentIntentId }))).toBe(
      "invalid_transition",
    ); // processing can't be cancelled
  });

  it("a late failure never downgrades a successful payment, and paid bookings can't be paid twice", async () => {
    const { bookingId, intent } = await paidIntent(8);
    expect(await deliver("payment.failed", intent.externalReference!, intent.amountCentavos)).toBe(
      "ignored:already_succeeded",
    );
    expect(
      reasonOf(
        await startPayment(
          customer.ctx,
          adminClient(),
          sandbox,
          { bookingId, idempotencyKey: crypto.randomUUID() },
          "/app",
        ),
      ),
    ).toBe("already_paid");
  });
});

describe("refunds", () => {
  it("partial refunds accumulate, are capped, idempotent, and confirmed only by provider events", async () => {
    const { intent } = await paidIntent(9);
    const key = crypto.randomUUID();
    const r1 = unwrap(await refund(providerOwner, intent.id, 50_000, key));
    expect(unwrap(await refund(providerOwner, intent.id, 50_000, key)).refundId).toBe(r1.refundId);
    expect(unwrap(await getPayment(customer.ctx, intent.id)).status).toBe("succeeded"); // pending until the provider confirms
    expect(reasonOf(await refund(providerOwner, intent.id, 100_001))).toBe("overrefund"); // 50 000 pending + 100 001 > 150 000
    const ref1 = await refundRef(r1.refundId);
    expect(await deliver("refund.succeeded", ref1, 50_000)).toBe("applied");
    expect(await deliver("refund.succeeded", ref1, 50_000)).toBe("ignored:already_final");
    expect(unwrap(await getPayment(customer.ctx, intent.id))).toMatchObject({
      status: "partially_refunded",
      amountRefundedCentavos: 50_000,
    });
    const r2 = unwrap(await refund(providerOwner, intent.id, 100_000));
    expect(await deliver("refund.succeeded", await refundRef(r2.refundId), 100_000)).toBe("applied");
    expect(unwrap(await getPayment(customer.ctx, intent.id))).toMatchObject({
      status: "refunded",
      amountRefundedCentavos: 150_000,
    });
    expect(reasonOf(await refund(providerOwner, intent.id, 1))).toBe("invalid_transition");
    // Refunds are audited.
    const audits = await withDb((c) =>
      c.query("select count(*) from public.audit_logs where action = 'payment.refund_requested' and target_id = $1", [
        r1.refundId,
      ]),
    );
    expect(Number(audits.rows[0].count)).toBe(1);
  });

  it("a failed refund frees the amount again", async () => {
    const { intent } = await paidIntent(10);
    const r = unwrap(await refund(providerOwner, intent.id, 150_000));
    expect(await deliver("refund.failed", await refundRef(r.refundId), 150_000)).toBe("applied");
    expect(unwrap(await getPayment(customer.ctx, intent.id)).status).toBe("succeeded");
    expect((await refund(providerOwner, intent.id, 150_000)).ok).toBe(true);
  });

  it("only owners/managers of the receiving business (or platform finance) can refund", async () => {
    const { intent } = await paidIntent(11);
    expect(reasonOf(await refund(providerStaff, intent.id, 100))).toBe("not_found");
    expect(reasonOf(await refund(customer, intent.id, 100))).toBe("not_found");
    expect(reasonOf(await refund(rivalProvider, intent.id, 100))).toBe("not_found");
    expect((await refund(finance, intent.id, 100)).ok).toBe(true);
  });
});

describe("cross-tenant financial access", () => {
  it("households and businesses see only their own payments; staff without finance access see none", async () => {
    const { intent } = await paidIntent(12);
    expect(unwrap(await listPayments(rivalCustomer.ctx, { householdId: household }))).toEqual([]);
    expect((await getPayment(rivalCustomer.ctx, intent.id)).ok).toBe(false);
    expect((await getPayment(rivalProvider.ctx, intent.id)).ok).toBe(false);
    expect((await getPayment(providerStaff.ctx, intent.id)).ok).toBe(false);
    expect((await getPayment(providerOwner.ctx, intent.id)).ok).toBe(true);
    const { data: events } = await rivalCustomer.client
      .from("payment_events")
      .select("id")
      .eq("payment_intent_id", intent.id);
    expect(events).toEqual([]);
    expect(unwrap(await listSettlements(rivalProvider.ctx, { organizationId: provider.orgId }))).toEqual([]);
    // A rival customer can't start a payment for someone else's booking.
    const bookingId = await confirmedBooking(13);
    expect(
      reasonOf(
        await startPayment(
          rivalCustomer.ctx,
          adminClient(),
          sandbox,
          { bookingId, idempotencyKey: crypto.randomUUID() },
          "/app",
        ),
      ),
    ).toBe("not_found");
    expect(rivalHousehold).toBeTruthy();
  });

  it("financial history is immutable", async () => {
    const { intent } = await paidIntent(14);
    await expect(
      withDb((c) =>
        c.query("update public.payment_events set amount_centavos = 1 where payment_intent_id = $1", [intent.id]),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      withDb((c) => c.query("delete from public.payment_events where payment_intent_id = $1", [intent.id])),
    ).rejects.toThrow(/append-only/);
  });
});

describe("settlements and reconciliation", () => {
  it("charges commission on the net, carries post-settlement refunds forward, and settles each item once", async () => {
    const today = manilaDateOf(new Date());
    // Settle anything left over from earlier tests so this run starts clean.
    await createSettlement(finance.ctx, { organizationId: provider.orgId, periodEnd: today });

    const a = await paidIntent(15);
    const ra = unwrap(await refund(providerOwner, a.intent.id, 50_000));
    await deliver("refund.succeeded", await refundRef(ra.refundId), 50_000);
    const b = await paidIntent(16);

    expect(reasonOf(await createSettlement(support.ctx, { organizationId: provider.orgId, periodEnd: today }))).toBe(
      "forbidden",
    );
    expect(
      reasonOf(await createSettlement(providerOwner.ctx, { organizationId: provider.orgId, periodEnd: today })),
    ).toBe("forbidden");
    const s1 = unwrap(
      await createSettlement(finance.ctx, { organizationId: provider.orgId, periodEnd: today }),
    ).settlementId;
    const { data: items1 } = await finance.client.from("settlement_items").select("*").eq("settlement_id", s1);
    const itemA = items1!.find((i) => i.payment_intent_id === a.intent.id)!;
    expect(itemA).toMatchObject({
      gross_centavos: 150_000,
      refunds_centavos: 50_000,
      commission_centavos: 10_000,
      net_centavos: 90_000,
    });
    const itemB = items1!.find((i) => i.payment_intent_id === b.intent.id)!;
    expect(itemB).toMatchObject({
      gross_centavos: 150_000,
      refunds_centavos: 0,
      commission_centavos: 15_000,
      net_centavos: 135_000,
    });
    const s1row = unwrap(await listSettlements(providerOwner.ctx, { organizationId: provider.orgId })).find(
      (s) => s.id === s1,
    )!;
    expect(s1row).toMatchObject({
      grossCentavos: 300_000,
      refundsCentavos: 50_000,
      commissionCentavos: 25_000,
      netCentavos: 225_000,
      itemCount: 2,
    });

    expect(reasonOf(await createSettlement(finance.ctx, { organizationId: provider.orgId, periodEnd: today }))).toBe(
      "invalid_input",
    ); // nothing new

    const rb = unwrap(await refund(providerOwner, b.intent.id, 30_000));
    await deliver("refund.succeeded", await refundRef(rb.refundId), 30_000);
    const s2 = unwrap(
      await createSettlement(finance.ctx, { organizationId: provider.orgId, periodEnd: today }),
    ).settlementId;
    const { data: items2 } = await finance.client.from("settlement_items").select("*").eq("settlement_id", s2);
    expect(items2).toHaveLength(1);
    expect(items2![0]).toMatchObject({
      kind: "refund_adjustment",
      gross_centavos: 0,
      refunds_centavos: 30_000,
      commission_centavos: -3_000,
      net_centavos: -27_000,
    });

    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(reasonOf(await createSettlement(finance.ctx, { organizationId: provider.orgId, periodEnd: tomorrow }))).toBe(
      "invalid_input",
    );
  });

  it("organization commission overrides apply to new payments only and can't be backdated", async () => {
    const today = manilaDateOf(new Date());
    expect(
      reasonOf(
        await setCommissionRate(finance.ctx, {
          organizationId: provider.orgId,
          rateBps: 750,
          effectiveFrom: "2020-01-01",
        }),
      ),
    ).toBe("invalid_input");
    expect(
      reasonOf(
        await setCommissionRate(providerOwner.ctx, {
          organizationId: provider.orgId,
          rateBps: 0,
          effectiveFrom: today,
        }),
      ),
    ).toBe("forbidden");
    unwrap(
      await setCommissionRate(finance.ctx, { organizationId: provider.orgId, rateBps: 750, effectiveFrom: today }),
    );
    const { intent } = await paidIntent(17);
    expect(intent.commissionCentavos).toBe(11_250);
    unwrap(
      await setCommissionRate(finance.ctx, { organizationId: provider.orgId, rateBps: 1000, effectiveFrom: today }),
    );
  });

  it("reconciliation flags amount, status and presence mismatches", async () => {
    const today = manilaDateOf(new Date());
    const ok1 = await paidIntent(18);
    const amountOff = await paidIntent(19);
    const missing = await paidIntent(20);
    const report = [
      { external_reference: ok1.intent.externalReference!, amount_centavos: 150_000, status: "succeeded" as const },
      {
        external_reference: amountOff.intent.externalReference!,
        amount_centavos: 149_000,
        status: "succeeded" as const,
      },
      { external_reference: "sbx_pi_not_ours", amount_centavos: 5_000, status: "succeeded" as const },
    ];
    expect(
      reasonOf(await runReconciliation(support.ctx, { provider: "sandbox", from: today, to: today, report })),
    ).toBe("forbidden");
    const run = unwrap(await runReconciliation(finance.ctx, { provider: "sandbox", from: today, to: today, report }));
    const byRef = Object.fromEntries(run.items.map((i) => [i.externalReference, i.result]));
    expect(byRef[ok1.intent.externalReference!]).toBe("matched");
    expect(byRef[amountOff.intent.externalReference!]).toBe("amount_mismatch");
    expect(byRef["sbx_pi_not_ours"]).toBe("missing_in_ledger");
    expect(byRef[missing.intent.externalReference!]).toBe("missing_at_provider");
    expect(run.mismatched).toBeGreaterThanOrEqual(3);
  });
});
