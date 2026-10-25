import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptOrganizationInvitation, inviteOrganizationMember } from "@bahayplus/modules/organizations";
import { acceptHouseholdInvitation, createHousehold, inviteHouseholdMember } from "@bahayplus/modules/households";
import { createProperty } from "@bahayplus/modules/properties";
import {
  assignWorkOrder,
  confirmBookingCompletion,
  createQuotationDraft,
  createServiceRequest,
  createWorkOrder,
  decideQuotation,
  getBooking,
  getBookingLocation,
  getWorkOrder,
  listBookingEvents,
  listQuotations,
  listWorkOrders,
  requestBooking,
  rescheduleBooking,
  saveQuotationDraft,
  sendQuotation,
  toggleChecklistItem,
  transitionBooking,
  updateWorkOrderStatus,
} from "@bahayplus/modules/bookings";
import {
  acceptProjectQuotation,
  addMilestone,
  createProjectRequest,
  decideChangeOrder,
  getProject,
  listChangeOrders,
  proposeChangeOrder,
  startProjectQuotation,
  updateProject,
} from "@bahayplus/modules/projects";
import { manilaDateOf, addDays } from "@bahayplus/types/dates";
import { withDb } from "../support/db";
import { createListedProvider, futureSlot, toManilaLocal } from "../support/marketplace";
import { adminClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

const today = manilaDateOf(new Date());
let providerOwner: TestUser;
let dispatcher: TestUser; // staff
let workerA: TestUser;
let workerB: TestUser;
let customer: TestUser;
let guest: TestUser; // guest in customer's household (no services.book)
let rivalCustomer: TestUser;
let rivalProvider: TestUser;
let household: string;
let property: string;
let rivalHousehold: string;
let rivalProperty: string;
let provider: { orgId: string; serviceId: string };

const book = (user: TestUser, hh: string, prop: string, start: string, key = randomUUID()) =>
  requestBooking(user.ctx, {
    householdId: hh,
    serviceId: provider.serviceId,
    propertyId: prop,
    start: toManilaLocal(start),
    idempotencyKey: key,
  });

beforeAll(async () => {
  [providerOwner, dispatcher, workerA, workerB, customer, guest, rivalCustomer, rivalProvider] = (await Promise.all(
    [
      "tx-owner",
      "tx-dispatch",
      "tx-worker-a",
      "tx-worker-b",
      "tx-customer",
      "tx-guest",
      "tx-rival-cust",
      "tx-rival-prov",
    ].map((l) => createTestUser(l)),
  )) as [TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser];
  provider = await createListedProvider(providerOwner, { name: "Tx Plumbing", capacity: 1, durationMinutes: 120 });
  for (const [user, role] of [
    [dispatcher, "staff"],
    [workerA, "worker"],
    [workerB, "worker"],
  ] as const) {
    const inv = unwrap(
      await inviteOrganizationMember(providerOwner.ctx, { organizationId: provider.orgId, email: user.email, role }),
    );
    unwrap(await acceptOrganizationInvitation(user.ctx, { token: inv.token }));
  }
  household = unwrap(await createHousehold(customer.ctx, { name: "Tx customer" })).householdId;
  property = unwrap(
    await createProperty(customer.ctx, {
      householdId: household,
      name: "Home",
      propertyType: "house",
      addressLine: "8 Acacia St.",
      barangay: "Kapitolyo",
      cityMunicipality: "Pasig",
      province: "Metro Manila",
    }),
  ).propertyId;
  const inv = unwrap(
    await inviteHouseholdMember(customer.ctx, { householdId: household, email: guest.email, role: "guest" }),
  );
  unwrap(await acceptHouseholdInvitation(guest.ctx, { token: inv.token }));
  rivalHousehold = unwrap(await createHousehold(rivalCustomer.ctx, { name: "Rival customer" })).householdId;
  rivalProperty = unwrap(
    await createProperty(rivalCustomer.ctx, {
      householdId: rivalHousehold,
      name: "Rival home",
      propertyType: "condominium",
      cityMunicipality: "Taguig",
      province: "Metro Manila",
    }),
  ).propertyId;
  await createListedProvider(rivalProvider, { name: "Rival Plumbing" });
});
afterAll(cleanupTestUsers);

describe("double booking and concurrency", () => {
  it("Book Now confirms instantly, and an overlapping slot is refused", async () => {
    const slot = futureSlot(3, 9);
    const first = unwrap(await book(customer, household, property, slot));
    expect(unwrap(await getBooking(customer.ctx, first.bookingId)).status).toBe("confirmed");
    const overlap = await book(
      rivalCustomer,
      rivalHousehold,
      rivalProperty,
      new Date(Date.parse(slot) + 3_600_000).toISOString(),
    );
    expect(overlap.ok || overlap.error.reason).toBe("slot_unavailable");
    // A non-overlapping slot is fine.
    expect((await book(rivalCustomer, rivalHousehold, rivalProperty, futureSlot(3, 13))).ok).toBe(true);
  });

  it("concurrent requests for the same slot produce exactly one confirmed booking", async () => {
    const slot = futureSlot(4, 9);
    const results = await Promise.all([
      book(customer, household, property, slot),
      book(rivalCustomer, rivalHousehold, rivalProperty, slot),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok ? failed.error.reason : "").toBe("slot_unavailable");
  });

  it("resubmitting the same booking form (same key) never creates a duplicate", async () => {
    const key = randomUUID();
    const slot = futureSlot(5, 15);
    const a = unwrap(await book(customer, household, property, slot, key));
    const b = unwrap(await book(customer, household, property, slot, key));
    expect(b.bookingId).toBe(a.bookingId);
  });

  it("guests and other households cannot book on someone's behalf", async () => {
    expect((await book(guest, household, property, futureSlot(6, 9))).ok).toBe(false);
    expect((await book(rivalCustomer, household, property, futureSlot(6, 9))).ok).toBe(false);
    const wrongProperty = await book(customer, household, rivalProperty, futureSlot(6, 9));
    expect(wrongProperty.ok || wrongProperty.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("rescheduling and cancellation", () => {
  it("reschedules within capacity, moves open work orders, and logs history", async () => {
    const b = unwrap(await book(customer, household, property, futureSlot(7, 9)));
    const wo = unwrap(await createWorkOrder(dispatcher.ctx, { bookingId: b.bookingId, checklist: ["Inspect pipes"] }));
    const newStart = futureSlot(8, 10);
    unwrap(
      await rescheduleBooking(customer.ctx, {
        bookingId: b.bookingId,
        start: toManilaLocal(newStart),
        reason: "Out of town",
      }),
    );
    expect(unwrap(await getBooking(customer.ctx, b.bookingId)).scheduledStart).toBe(
      newStart.replace(".000Z", "+00:00"),
    );
    expect(Date.parse(unwrap(await getWorkOrder(dispatcher.ctx, wo.workOrderId)).scheduledStart)).toBe(
      Date.parse(newStart),
    );
    // Moving onto a fully booked slot is refused.
    const busy = unwrap(await book(rivalCustomer, rivalHousehold, rivalProperty, futureSlot(9, 9)));
    const clash = await rescheduleBooking(customer.ctx, {
      bookingId: b.bookingId,
      start: toManilaLocal(futureSlot(9, 9)),
      reason: "x",
    });
    expect(clash.ok || clash.error.reason).toBe("slot_unavailable");
    expect(busy.bookingId).toBeTruthy();
    expect(unwrap(await listBookingEvents(customer.ctx, b.bookingId)).map((e) => e.kind)).toEqual([
      "created",
      "rescheduled",
    ]);
  });

  it("cancellation needs a reason, cancels open work orders and frees the slot", async () => {
    const slot = futureSlot(10, 9);
    const b = unwrap(await book(customer, household, property, slot));
    const wo = unwrap(await createWorkOrder(dispatcher.ctx, { bookingId: b.bookingId }));
    expect((await transitionBooking(customer.ctx, { bookingId: b.bookingId, action: "cancel", reason: "" })).ok).toBe(
      false,
    );
    unwrap(
      await transitionBooking(customer.ctx, { bookingId: b.bookingId, action: "cancel", reason: "No longer needed" }),
    );
    expect(unwrap(await getBooking(customer.ctx, b.bookingId))).toMatchObject({
      status: "cancelled",
      cancelledBy: "customer",
    });
    expect(unwrap(await getWorkOrder(dispatcher.ctx, wo.workOrderId)).status).toBe("cancelled");
    expect((await book(rivalCustomer, rivalHousehold, rivalProperty, slot)).ok).toBe(true);
    const again = await transitionBooking(customer.ctx, { bookingId: b.bookingId, action: "cancel", reason: "again" });
    expect(again.ok || again.error.reason).toBe("invalid_transition");
  });

  it("customers cannot perform provider actions, and other providers cannot touch the booking", async () => {
    const b = unwrap(await book(customer, household, property, futureSlot(11, 9)));
    const selfComplete = await transitionBooking(customer.ctx, {
      bookingId: b.bookingId,
      action: "complete",
      reason: "",
    });
    expect(selfComplete.ok || selfComplete.error.reason).toBe("invalid_transition");
    const rival = await transitionBooking(rivalProvider.ctx, {
      bookingId: b.bookingId,
      action: "cancel",
      reason: "sabotage",
    });
    expect(rival.ok || rival.error.code).toBe("NOT_FOUND");
    expect((await getBooking(rivalProvider.ctx, b.bookingId)).ok).toBe(false);
  });
});

describe("customer address privacy", () => {
  it("providers see the address only once the booking is confirmed", async () => {
    // Quote-flow bookings start as "requested".
    const req = unwrap(
      await createServiceRequest(customer.ctx, {
        householdId: household,
        organizationId: provider.orgId,
        propertyId: property,
        title: "Bathroom leak",
        idempotencyKey: randomUUID(),
      }),
    );
    const draft = unwrap(await createQuotationDraft(providerOwner.ctx, { requestId: req.requestId }));
    unwrap(
      await saveQuotationDraft(providerOwner.ctx, {
        quotationId: draft.quotationId,
        lines: [{ description: "Labor", quantity: "1", unitPriceCentavos: "900" }],
      }),
    );
    unwrap(await sendQuotation(providerOwner.ctx, { quotationId: draft.quotationId, validUntil: addDays(today, 7) }));
    const booking = unwrap(
      await decideQuotation(customer.ctx, {
        quotationId: draft.quotationId,
        decision: "accepted",
        start: toManilaLocal(futureSlot(12, 14)),
      }),
    ).bookingId!;
    expect(unwrap(await getBookingLocation(providerOwner.ctx, booking))).toBeNull();
    expect(unwrap(await getBookingLocation(customer.ctx, booking))?.address).toContain("Kapitolyo");
    unwrap(await transitionBooking(providerOwner.ctx, { bookingId: booking, action: "confirm", reason: "" }));
    expect(unwrap(await getBookingLocation(providerOwner.ctx, booking))?.address).toContain("8 Acacia St.");
    expect(unwrap(await getBookingLocation(rivalProvider.ctx, booking))).toBeNull();
    expect((await providerOwner.client.from("properties").select("id").eq("id", property)).data).toEqual([]);
  });
});

describe("quotations", () => {
  let requestId: string;

  beforeAll(async () => {
    requestId = unwrap(
      await createServiceRequest(customer.ctx, {
        householdId: household,
        organizationId: provider.orgId,
        propertyId: property,
        title: "Replace kitchen sink",
        idempotencyKey: randomUUID(),
      }),
    ).requestId;
  });

  it("customers never see drafts; sent versions are immutable and totals use exact centavos", async () => {
    const v1 = unwrap(await createQuotationDraft(providerOwner.ctx, { requestId }));
    unwrap(
      await saveQuotationDraft(providerOwner.ctx, {
        quotationId: v1.quotationId,
        notes: "Includes materials",
        lines: [
          { description: "Sink (stainless)", quantity: "1", unitPriceCentavos: "4,500" },
          { description: "Labor", quantity: "2.5", unitLabel: "hrs", unitPriceCentavos: "333.33" },
        ],
      }),
    );
    expect(unwrap(await listQuotations(customer.ctx, requestId))).toEqual([]);
    unwrap(await sendQuotation(providerOwner.ctx, { quotationId: v1.quotationId, validUntil: addDays(today, 7) }));
    const [sent] = unwrap(await listQuotations(customer.ctx, requestId));
    // 2.5 × ₱333.33 = ₱833.325 → ₱833.33 (half away from zero); total ₱5,333.33.
    expect(sent).toMatchObject({ version: 1, status: "sent", totalCentavos: 533_333 });
    const edit = await saveQuotationDraft(providerOwner.ctx, {
      quotationId: v1.quotationId,
      lines: [{ description: "Cheaper", quantity: "1", unitPriceCentavos: "1" }],
    });
    expect(edit.ok || edit.error.reason).toBe("quotation_locked");
    const lineTamper = await providerOwner.client
      .from("quotation_lines")
      .update({ unit_price_centavos: 1 })
      .eq("quotation_id", v1.quotationId);
    expect(lineTamper.error?.message).toBe("quotation_locked");
  });

  it("a new version supersedes the old one; only the household may accept", async () => {
    const v2 = unwrap(await createQuotationDraft(providerOwner.ctx, { requestId }));
    unwrap(
      await saveQuotationDraft(providerOwner.ctx, {
        quotationId: v2.quotationId,
        lines: [{ description: "Sink + install", quantity: "1", unitPriceCentavos: "5,000" }],
      }),
    );
    unwrap(await sendQuotation(providerOwner.ctx, { quotationId: v2.quotationId, validUntil: addDays(today, 3) }));
    const versions = unwrap(await listQuotations(customer.ctx, requestId));
    expect(versions.map((q) => [q.version, q.status])).toEqual([
      [2, "sent"],
      [1, "superseded"],
    ]);
    const old = await decideQuotation(customer.ctx, { quotationId: versions[1]!.id, decision: "accepted" });
    expect(old.ok || old.error.reason).toBe("quotation_not_open");
    for (const intruder of [providerOwner, guest, rivalCustomer]) {
      const r = await decideQuotation(intruder.ctx, { quotationId: v2.quotationId, decision: "accepted" });
      expect(r.ok, intruder.email).toBe(false);
    }
  });

  it("acceptance freezes the price: no edits, no withdrawals, booking carries the amount", async () => {
    const [latest] = unwrap(await listQuotations(customer.ctx, requestId));
    const accepted = unwrap(await decideQuotation(customer.ctx, { quotationId: latest!.id, decision: "accepted" }));
    expect(unwrap(await getBooking(customer.ctx, accepted.bookingId!)).agreedAmountCentavos).toBe(500_000);
    const admin = adminClient();
    const raise = await admin.from("quotations").update({ total_centavos: 999_999 }).eq("id", latest!.id);
    expect(raise.error?.message).toBe("quotation_locked"); // not even the service role
    const withdraw = await providerOwner.client.rpc("withdraw_quotation", { p_quotation: latest!.id });
    expect(withdraw.error?.message).toBe("quotation_locked");
    const another = await createQuotationDraft(providerOwner.ctx, { requestId });
    expect(another.ok || another.error.reason).toBe("invalid_transition");
  });

  it("expired quotations cannot be accepted", async () => {
    const req = unwrap(
      await createServiceRequest(customer.ctx, {
        householdId: household,
        organizationId: provider.orgId,
        propertyId: property,
        title: "Water heater",
        idempotencyKey: randomUUID(),
      }),
    );
    const q = unwrap(await createQuotationDraft(providerOwner.ctx, { requestId: req.requestId }));
    unwrap(
      await saveQuotationDraft(providerOwner.ctx, {
        quotationId: q.quotationId,
        lines: [{ description: "Install", quantity: "1", unitPriceCentavos: "2,000" }],
      }),
    );
    unwrap(await sendQuotation(providerOwner.ctx, { quotationId: q.quotationId, validUntil: today }));
    // Sent quotations are immutable even for the service role, so simulate time passing at the DB level.
    const blocked = await adminClient()
      .from("quotations")
      .update({ valid_until: addDays(today, -1) })
      .eq("id", q.quotationId);
    expect(blocked.error?.message).toBe("quotation_locked");
    await withDb(async (c) => {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      await c.query("update public.quotations set valid_until = $1 where id = $2", [addDays(today, -1), q.quotationId]);
      await c.query("commit");
    });
    const late = await decideQuotation(customer.ctx, { quotationId: q.quotationId, decision: "accepted" });
    expect(late.ok || late.error.reason).toBe("quotation_expired");
  });
});

describe("work orders and workers", () => {
  it("workers see only their assignments; reassignment keeps history and respects overlaps", async () => {
    const b1 = unwrap(await book(customer, household, property, futureSlot(14, 9)));
    const b2 = unwrap(await book(rivalCustomer, rivalHousehold, rivalProperty, futureSlot(14, 13)));
    const wo1 = unwrap(
      await createWorkOrder(dispatcher.ctx, {
        bookingId: b1.bookingId,
        checklist: ["Shut off water", "Replace washer"],
      }),
    );
    const wo2 = unwrap(await createWorkOrder(dispatcher.ctx, { bookingId: b2.bookingId }));
    unwrap(await assignWorkOrder(dispatcher.ctx, { workOrderId: wo1.workOrderId, workerId: workerA.id }));
    expect(unwrap(await listWorkOrders(workerA.ctx, { organizationId: provider.orgId })).map((w) => w.id)).toEqual([
      wo1.workOrderId,
    ]);
    expect(unwrap(await listWorkOrders(workerB.ctx, { organizationId: provider.orgId }))).toEqual([]);
    expect((await getWorkOrder(workerB.ctx, wo1.workOrderId)).ok).toBe(false);
    // Workers can't assign, and can't assign customers or outsiders.
    expect((await assignWorkOrder(workerA.ctx, { workOrderId: wo2.workOrderId, workerId: workerA.id })).ok).toBe(false);
    const outsider = await assignWorkOrder(dispatcher.ctx, { workOrderId: wo2.workOrderId, workerId: customer.id });
    expect(outsider.ok || outsider.error.code).toBe("VALIDATION_FAILED");
    // Reassign to worker B: A loses access immediately.
    unwrap(await assignWorkOrder(dispatcher.ctx, { workOrderId: wo1.workOrderId, workerId: workerB.id }));
    expect(unwrap(await listWorkOrders(workerA.ctx, { organizationId: provider.orgId }))).toEqual([]);
    const { data: history } = await adminClient()
      .from("work_order_assignments")
      .select("worker_id, active")
      .eq("work_order_id", wo1.workOrderId)
      .order("created_at");
    expect(history?.map((h) => [h.worker_id, h.active])).toEqual([
      [workerA.id, false],
      [workerB.id, true],
    ]);
    // Overlapping jobs for the same worker are refused.
    const b3 = await book(customer, household, property, futureSlot(15, 9));
    const wo3 = unwrap(
      await createWorkOrder(dispatcher.ctx, {
        bookingId: unwrap(b3).bookingId,
        start: toManilaLocal(futureSlot(14, 10)),
        end: toManilaLocal(futureSlot(14, 11)),
      }),
    );
    const clash = await assignWorkOrder(dispatcher.ctx, { workOrderId: wo3.workOrderId, workerId: workerB.id });
    expect(clash.ok || clash.error.reason).toBe("worker_unavailable");
  });

  it("completion requires the checklist and completes the booking for customer confirmation", async () => {
    const b = unwrap(await book(customer, household, property, futureSlot(16, 9)));
    const wo = unwrap(await createWorkOrder(dispatcher.ctx, { bookingId: b.bookingId, checklist: ["Test for leaks"] }));
    unwrap(await assignWorkOrder(dispatcher.ctx, { workOrderId: wo.workOrderId, workerId: workerA.id }));
    unwrap(await updateWorkOrderStatus(workerA.ctx, { workOrderId: wo.workOrderId, status: "in_progress" }));
    expect(unwrap(await getBooking(customer.ctx, b.bookingId)).status).toBe("in_progress");
    const early = await updateWorkOrderStatus(workerA.ctx, { workOrderId: wo.workOrderId, status: "completed" });
    expect(early.ok || early.error.reason).toBe("checklist_incomplete");
    const item = unwrap(await getWorkOrder(workerA.ctx, wo.workOrderId)).checklist[0]!;
    unwrap(await toggleChecklistItem(workerA.ctx, { itemId: item.id, done: true }));
    expect((await toggleChecklistItem(workerB.ctx, { itemId: item.id, done: false })).ok).toBe(false);
    unwrap(
      await updateWorkOrderStatus(workerA.ctx, {
        workOrderId: wo.workOrderId,
        status: "completed",
        notes: "Replaced washer",
      }),
    );
    expect(unwrap(await getBooking(customer.ctx, b.bookingId)).status).toBe("completed");
    expect(
      (await confirmBookingCompletion(providerOwner.ctx, { bookingId: b.bookingId, outcome: "confirmed" })).ok,
    ).toBe(false);
    unwrap(await confirmBookingCompletion(customer.ctx, { bookingId: b.bookingId, outcome: "confirmed" }));
    expect(unwrap(await getBooking(customer.ctx, b.bookingId)).customerConfirmation).toBe("confirmed");
  });
});

describe("projects and change orders", () => {
  let projectId: string;

  beforeAll(async () => {
    projectId = unwrap(
      await createProjectRequest(customer.ctx, {
        householdId: household,
        organizationId: provider.orgId,
        propertyId: property,
        kind: "cabinetry",
        title: "Kitchen cabinets",
        description: "Upper and lower cabinets, 3 meters",
      }),
    ).projectId;
  });

  it("work cannot start until the customer accepts the contract quotation", async () => {
    unwrap(
      await updateProject(providerOwner.ctx, {
        projectId,
        status: "site_visit_scheduled",
        siteVisitAt: toManilaLocal(futureSlot(2, 10)),
      }),
    );
    const tooEarly = await updateProject(providerOwner.ctx, { projectId, status: "active" });
    expect(tooEarly.ok || tooEarly.error.reason).toBe("contract_required");
    const draft = unwrap(await startProjectQuotation(providerOwner.ctx, { projectId }));
    unwrap(
      await saveQuotationDraft(providerOwner.ctx, {
        quotationId: draft.quotationId,
        lines: [{ description: "Cabinets", quantity: "3", unitLabel: "m", unitPriceCentavos: "25,000" }],
      }),
    );
    unwrap(await sendQuotation(providerOwner.ctx, { quotationId: draft.quotationId, validUntil: addDays(today, 14) }));
    expect((await acceptProjectQuotation(providerOwner.ctx, { projectId, quotationId: draft.quotationId })).ok).toBe(
      false,
    );
    unwrap(await acceptProjectQuotation(customer.ctx, { projectId, quotationId: draft.quotationId }));
    expect(unwrap(await getProject(customer.ctx, projectId))).toMatchObject({
      contractAmountCentavos: 7_500_000,
      currentAmountCentavos: 7_500_000,
    });
    unwrap(
      await updateProject(providerOwner.ctx, {
        projectId,
        status: "active",
        startDate: today,
        targetEndDate: addDays(today, 30),
      }),
    );
    unwrap(
      await addMilestone(providerOwner.ctx, { projectId, title: "Materials delivered", amountCentavos: "30,000" }),
    );
    expect((await addMilestone(customer.ctx, { projectId, title: "Sneaky" })).ok).toBe(false);
  });

  it("price and scope changes need explicit customer approval", async () => {
    const co = unwrap(
      await proposeChangeOrder(providerOwner.ctx, {
        projectId,
        title: "Add pantry cabinet",
        amountDeltaCentavos: "12,500",
        scheduleDeltaDays: 5,
      }),
    );
    // Pending changes don't affect the price; a second proposal waits.
    expect(unwrap(await getProject(customer.ctx, projectId)).currentAmountCentavos).toBe(7_500_000);
    const second = await proposeChangeOrder(providerOwner.ctx, {
      projectId,
      title: "Another",
      amountDeltaCentavos: "1",
    });
    expect(second.ok || second.error.reason).toBe("change_order_pending");
    // The contractor cannot approve their own change; guests and outsiders cannot either.
    for (const u of [providerOwner, dispatcher, guest, rivalCustomer]) {
      expect(
        (await decideChangeOrder(u.ctx, { changeOrderId: co.changeOrderId, decision: "approved" })).ok,
        u.email,
      ).toBe(false);
    }
    unwrap(
      await decideChangeOrder(customer.ctx, { changeOrderId: co.changeOrderId, decision: "approved", note: "OK" }),
    );
    const project = unwrap(await getProject(customer.ctx, projectId));
    expect(project).toMatchObject({
      approvedChangesCentavos: 1_250_000,
      currentAmountCentavos: 8_750_000,
      targetEndDate: addDays(today, 35),
    });
    const twice = await decideChangeOrder(customer.ctx, { changeOrderId: co.changeOrderId, decision: "rejected" });
    expect(twice.ok || twice.error.reason).toBe("invalid_transition");
    const reduce = unwrap(
      await proposeChangeOrder(providerOwner.ctx, {
        projectId,
        title: "Remove crown molding",
        amountDeltaCentavos: "-2,000",
      }),
    );
    unwrap(await decideChangeOrder(customer.ctx, { changeOrderId: reduce.changeOrderId, decision: "rejected" }));
    expect(unwrap(await getProject(customer.ctx, projectId)).currentAmountCentavos).toBe(8_750_000);
    expect(unwrap(await listChangeOrders(customer.ctx, projectId)).map((c) => c.status)).toEqual([
      "rejected",
      "approved",
    ]);
  });

  it("projects are invisible to other households and providers", async () => {
    expect((await getProject(rivalCustomer.ctx, projectId)).ok).toBe(false);
    expect((await getProject(rivalProvider.ctx, projectId)).ok).toBe(false);
    expect((await updateProject(rivalProvider.ctx, { projectId, status: "completed" })).ok).toBe(false);
    expect(
      (await proposeChangeOrder(rivalProvider.ctx, { projectId, title: "Free money", amountDeltaCentavos: "999,999" }))
        .ok,
    ).toBe(false);
  });

  it("completion records the warranty", async () => {
    unwrap(
      await updateProject(providerOwner.ctx, {
        projectId,
        status: "completed",
        warrantyUntil: addDays(today, 365),
        warrantyTerms: "1-year workmanship warranty",
      }),
    );
    expect(unwrap(await getProject(customer.ctx, projectId))).toMatchObject({
      status: "completed",
      warrantyUntil: addDays(today, 365),
    });
    expect((await updateProject(providerOwner.ctx, { projectId, status: "active" })).ok).toBe(false);
  });
});
