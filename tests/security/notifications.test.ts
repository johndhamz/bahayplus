import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptHouseholdInvitation,
  createHousehold,
  inviteHouseholdMember,
  listHouseholdMembers,
  removeHouseholdMember,
} from "@bahayplus/modules/households";
import { requestBooking, rescheduleBooking, transitionBooking } from "@bahayplus/modules/bookings";
import { searchUrgentProviders } from "@bahayplus/modules/marketplace";
import {
  DeliveryError,
  listNotifications,
  processChannel,
  updatePreferences,
  type ChannelAdapter,
} from "@bahayplus/modules/notifications";
import { createProperty } from "@bahayplus/modules/properties";
import { assignCalendarItem, listCalendarItems, monthRange, shiftMonth } from "@bahayplus/modules/scheduling";
import { addDays, manilaDateOf } from "@bahayplus/types/dates";
import { withDb } from "../support/db";
import { createListedProvider, futureSlot, toManilaLocal } from "../support/marketplace";
import { adminClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

let owner: TestUser; // household owner
let member: TestUser; // household member
let guest: TestUser; // household guest (household.view only)
let outsider: TestUser;
let providerOwner: TestUser;
let household: string;
let property: string;
let provider: { orgId: string; serviceId: string };

const admin = () => adminClient();

/** Creates a notification exactly as the reminder/event pipeline does (DB function, service context). */
async function notify(user: TestUser, kind: string, dedupe: string, permission: string | null = "bills.view") {
  return withDb(async (c) => {
    const { rows } = await c.query(
      "select private.create_notification($1, $2, null, $3, 'Test title', 'Body', '/app', $4, $5) as id",
      [user.id, household, kind, dedupe, permission],
    );
    return rows[0].id as string | null;
  });
}

async function delivery(notificationId: string, channel: string) {
  const { data } = await admin()
    .from("notification_deliveries")
    .select("*")
    .eq("notification_id", notificationId)
    .eq("channel", channel)
    .maybeSingle();
  return data;
}

/**
 * Claims email deliveries until ours shows up. Other tests' messages that we happen to claim are
 * completed as "test-drain" so they don't linger in the shared local queue.
 */
async function claimEmail(deliveryId: string) {
  const { data, error } = await admin().rpc("claim_notification_deliveries", {
    p_channel: "email",
    p_batch: 100,
    p_visibility_seconds: 60,
  });
  if (error) throw new Error(error.message);
  let mine: (typeof data)[number] | undefined;
  for (const row of data ?? []) {
    if (row.delivery_id === deliveryId) mine = row;
    else
      await admin().rpc("complete_notification_delivery", {
        p_delivery: row.delivery_id,
        p_msg_id: row.msg_id,
        p_provider: "test-drain",
      });
  }
  return mine;
}

/** Skips the backoff wait so a retry can be claimed immediately. */
async function makeReady(deliveryId: string) {
  await withDb(async (c) => {
    await c.query(
      "update public.notification_deliveries set next_attempt_at = now() - interval '1 second' where id = $1",
      [deliveryId],
    );
    await c.query(
      "select pgmq.set_vt('notification_email', msg_id, 0) from pgmq.q_notification_email where message ->> 'delivery_id' = $1",
      [deliveryId],
    );
  });
}

beforeAll(async () => {
  [owner, member, guest, outsider, providerOwner] = (await Promise.all(
    ["nt-owner", "nt-member", "nt-guest", "nt-outsider", "nt-provider"].map((l) => createTestUser(l)),
  )) as [TestUser, TestUser, TestUser, TestUser, TestUser];
  household = unwrap(await createHousehold(owner.ctx, { name: "Notify household" })).householdId;
  property = unwrap(
    await createProperty(owner.ctx, {
      householdId: household,
      name: "Home",
      propertyType: "house",
      addressLine: "3 Dao St.",
      barangay: "Kapitolyo",
      cityMunicipality: "Pasig",
      province: "Metro Manila",
    }),
  ).propertyId;
  for (const [user, role] of [
    [member, "member"],
    [guest, "guest"],
  ] as const) {
    const inv = unwrap(await inviteHouseholdMember(owner.ctx, { householdId: household, email: user.email, role }));
    unwrap(await acceptHouseholdInvitation(user.ctx, { token: inv.token }));
  }
  provider = await createListedProvider(providerOwner, { name: "Notify Plumbing", capacity: 3, durationMinutes: 60 });
  await admin()
    .from("service_areas")
    .insert({ organization_id: provider.orgId, province: "Metro Manila", city_municipality: "Pasig" });
});
afterAll(cleanupTestUsers);

describe("notifications and preferences", () => {
  it("a customer booking notifies the provider team (in-app + queued email) but not the actor", async () => {
    const booking = unwrap(
      await requestBooking(owner.ctx, {
        householdId: household,
        serviceId: provider.serviceId,
        propertyId: property,
        start: toManilaLocal(futureSlot(5, 10)),
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    const { data: providerNotes } = await admin()
      .from("notifications")
      .select("id, kind, organization_id, notification_deliveries(channel, status)")
      .eq("recipient_id", providerOwner.id)
      .like("dedupe_key", "booking_event:%");
    const note = providerNotes?.find((n) => n.organization_id === provider.orgId);
    expect(note?.kind).toBe("booking.requested");
    const channels = Object.fromEntries((note?.notification_deliveries ?? []).map((d) => [d.channel, d.status]));
    expect(channels).toMatchObject({ in_app: "sent", email: "queued" });
    const { count } = await admin()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", owner.id)
      .like("dedupe_key", "booking_event:%");
    expect(count).toBe(0);
    expect(booking.bookingId).toBeTruthy();
  });

  it("the same logical event never creates a second notification", async () => {
    const key = `dup:${crypto.randomUUID()}`;
    expect(await notify(member, "bill.reminder", key)).toBeTruthy();
    expect(await notify(member, "bill.reminder", key)).toBeNull();
    const { count } = await admin()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", member.id)
      .eq("dedupe_key", key);
    expect(count).toBe(1);
  });

  it("preferences: in-app off hides from the inbox, email off creates no email delivery", async () => {
    unwrap(
      await updatePreferences(member.ctx, {
        preferences: [
          { category: "bills", channel: "in_app", enabled: false },
          { category: "bills", channel: "email", enabled: false },
        ],
      }),
    );
    const id = (await notify(member, "bill.reminder", `pref:${crypto.randomUUID()}`))!;
    expect(await delivery(id, "in_app")).toMatchObject({ status: "skipped", skip_reason: "preference_disabled" });
    expect(await delivery(id, "email")).toBeNull();
    const inbox = unwrap(await listNotifications(member.ctx));
    expect(inbox.some((n) => n.id === id)).toBe(false);
    // Other categories keep the defaults.
    const other = (await notify(member, "booking.confirmed", `pref2:${crypto.randomUUID()}`, "services.view"))!;
    expect(await delivery(other, "email")).toMatchObject({ status: "queued" });
    unwrap(
      await updatePreferences(member.ctx, {
        preferences: [
          { category: "bills", channel: "in_app", enabled: true },
          { category: "bills", channel: "email", enabled: true },
        ],
      }),
    );
  });

  it("SMS and push can't be switched on through the app, and are never reported as sent", async () => {
    const r = await updatePreferences(member.ctx, {
      preferences: [{ category: "bills", channel: "sms", enabled: true }],
    });
    expect(r.ok).toBe(false);
    // Even a stored preference (e.g. set directly) only produces a "not configured" record.
    await member.client
      .from("notification_preferences")
      .upsert({ user_id: member.id, category: "projects", channel: "push", enabled: true });
    const id = (await notify(member, "project.milestone", `push:${crypto.randomUUID()}`, "services.view"))!;
    expect(await delivery(id, "push")).toMatchObject({ status: "skipped", skip_reason: "channel_not_configured" });
  });
});

describe("delivery retries and idempotency", () => {
  it("retryable failures back off; a permanent failure stops; every attempt is logged", async () => {
    const id = (await notify(owner, "bill.reminder", `retry:${crypto.randomUUID()}`))!;
    const d = (await delivery(id, "email"))!;
    const first = await claimEmail(d.id);
    expect(first?.attempt).toBe(1);
    expect(first?.email).toBe(owner.email);
    expect(
      (
        await admin().rpc("fail_notification_delivery", {
          p_delivery: d.id,
          p_msg_id: first!.msg_id,
          p_error: "timeout",
          p_retryable: true,
        })
      ).data,
    ).toBe("retry");
    const queued = (await delivery(id, "email"))!;
    expect(queued.status).toBe("queued");
    expect(Date.parse(queued.next_attempt_at!) - Date.now()).toBeGreaterThan(20_000);
    // Not handed out again before the backoff elapses.
    expect(await claimEmail(d.id)).toBeUndefined();
    await makeReady(d.id);
    const second = await claimEmail(d.id);
    expect(second?.attempt).toBe(2);
    expect(
      (
        await admin().rpc("fail_notification_delivery", {
          p_delivery: d.id,
          p_msg_id: second!.msg_id,
          p_error: "invalid recipient",
          p_retryable: false,
        })
      ).data,
    ).toBe("failed");
    expect(await delivery(id, "email")).toMatchObject({
      status: "failed",
      attempts: 2,
      last_error: "invalid recipient",
    });
    const log = await withDb((c) =>
      c.query("select outcome from private.notification_delivery_attempts where delivery_id = $1 order by id", [d.id]),
    );
    expect(log.rows.map((r) => r.outcome)).toEqual(["failed", "failed"]);
  });

  it("gives up after max attempts even when errors stay retryable", async () => {
    const id = (await notify(owner, "bill.reminder", `max:${crypto.randomUUID()}`))!;
    const d = (await delivery(id, "email"))!;
    await withDb((c) => c.query("update public.notification_deliveries set max_attempts = 2 where id = $1", [d.id]));
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) await makeReady(d.id);
      const row = await claimEmail(d.id);
      expect(row?.attempt).toBe(attempt);
      await admin().rpc("fail_notification_delivery", {
        p_delivery: d.id,
        p_msg_id: row!.msg_id,
        p_error: "503",
        p_retryable: true,
      });
    }
    expect(await delivery(id, "email")).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("the worker sends through the adapter once; re-running never re-sends", async () => {
    const id = (await notify(owner, "bill.reminder", `worker:${crypto.randomUUID()}`))!;
    const d = (await delivery(id, "email"))!;
    const sent: string[] = [];
    const adapter: ChannelAdapter = {
      channel: "email",
      provider: "fake",
      send: async (m) => {
        sent.push(m.deliveryId);
        return { providerMessageId: `fake-${m.deliveryId}` };
      },
    };
    await processChannel(admin(), "email", adapter, { batch: 100 });
    expect(await delivery(id, "email")).toMatchObject({
      status: "sent",
      provider: "fake",
      provider_message_id: `fake-${d.id}`,
    });
    await processChannel(admin(), "email", adapter, { batch: 100 });
    expect(sent.filter((s) => s === d.id)).toHaveLength(1);
  });

  it("an adapter error is retried; no adapter means 'not configured', not 'sent'", async () => {
    const failing = (await notify(owner, "bill.reminder", `fail:${crypto.randomUUID()}`))!;
    const failingDelivery = (await delivery(failing, "email"))!;
    const broken: ChannelAdapter = {
      channel: "email",
      provider: "fake",
      send: async () => {
        throw new DeliveryError("Provider responded 503", true);
      },
    };
    await processChannel(admin(), "email", broken, { batch: 100 });
    expect(await delivery(failing, "email")).toMatchObject({
      status: "queued",
      last_error: "Provider responded 503",
      attempts: 1,
    });

    await makeReady(failingDelivery.id);
    await processChannel(admin(), "email", null, { batch: 100 });
    expect(await delivery(failing, "email")).toMatchObject({
      status: "skipped",
      skip_reason: "channel_not_configured",
    });
  });

  it("stale queue messages never starve fresh deliveries", async () => {
    await withDb((c) =>
      c.query(
        "select pgmq.send('notification_email', jsonb_build_object('delivery_id', gen_random_uuid())) from generate_series(1, 40)",
      ),
    );
    const id = (await notify(owner, "bill.reminder", `backlog:${crypto.randomUUID()}`))!;
    const d = (await delivery(id, "email"))!;
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const { data } = await admin().rpc("claim_notification_deliveries", {
        p_channel: "email",
        p_batch: 5,
        p_visibility_seconds: 60,
      });
      for (const row of data ?? []) {
        if (row.delivery_id === d.id) found = true;
        await admin().rpc("complete_notification_delivery", {
          p_delivery: row.delivery_id,
          p_msg_id: row.msg_id,
          p_provider: "test-drain",
        });
      }
      if (!data?.length) break;
    }
    expect(found).toBe(true);
  });

  it("only the service role can run the delivery worker functions", async () => {
    const r = await owner.client.rpc("claim_notification_deliveries", {
      p_channel: "email",
      p_batch: 1,
      p_visibility_seconds: 30,
    });
    expect(r.error).not.toBeNull();
    const w = await owner.client.rpc("run_reminder_worker");
    expect(w.error).not.toBeNull();
  });
});

describe("revoked access", () => {
  it("a member removed after an email was queued doesn't receive it, nor later reminders", async () => {
    const leaver = await createTestUser("nt-leaver");
    const inv = unwrap(
      await inviteHouseholdMember(owner.ctx, { householdId: household, email: leaver.email, role: "member" }),
    );
    unwrap(await acceptHouseholdInvitation(leaver.ctx, { token: inv.token }));
    const id = (await notify(leaver, "bill.reminder", `revoke:${crypto.randomUUID()}`))!;
    const d = (await delivery(id, "email"))!;
    const membership = unwrap(await listHouseholdMembers(owner.ctx, household)).find((m) => m.userId === leaver.id)!;
    unwrap(await removeHouseholdMember(owner.ctx, { memberId: membership.id }));
    expect(await claimEmail(d.id)).toBeUndefined();
    expect(await delivery(id, "email")).toMatchObject({ status: "skipped", skip_reason: "access_revoked" });
    // Reminder fan-out uses current memberships.
    const sent = await withDb(async (c) => {
      const { rows } = await c.query(
        "select private.notify_household($1, 'bills.view', 'bill.reminder', 'x', '', null, $2) as n",
        [household, `fan:${crypto.randomUUID()}`],
      );
      return rows[0].n as number;
    });
    expect(sent).toBe(2); // owner + member; not the removed member, not the guest (no bills.view)
    const { count } = await admin()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", leaver.id)
      .like("dedupe_key", "fan:%");
    expect(count).toBe(0);
  });
});

describe("reminder engine", () => {
  it("timezone: reminders fire at 08:00 Manila, which is 00:00 UTC the same day", async () => {
    const r = await withDb((c) =>
      c.query(
        "select private.manila_at('2026-11-01', 8) as morning, private.manila_at('2026-11-01', 0) as midnight, private.manila_at('2026-12-31', 23) as late",
      ),
    );
    expect(new Date(r.rows[0].morning).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(new Date(r.rows[0].midnight).toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(new Date(r.rows[0].late).toISOString()).toBe("2026-12-31T15:00:00.000Z");
  });

  it("registry sync schedules each reminder once, enqueues only when due, and delivers idempotently", async () => {
    const today = manilaDateOf(new Date());
    const due = addDays(today, 7);
    const { data: asset } = await admin()
      .from("assets")
      .insert({
        household_id: household,
        property_id: property,
        name: `Ref ${Date.now()}`,
        category: "refrigerator",
        warranty_expires_on: due,
      })
      .select("id")
      .single();
    const sync = () => withDb((c) => c.query("select private.sync_registry_reminders($1::date)", [today]));
    await sync();
    await sync();
    const { data: reminders } = await admin()
      .from("reminders")
      .select("id, dedupe_key, remind_at, status")
      .eq("source_id", asset!.id)
      .order("remind_at");
    expect(reminders).toHaveLength(2);
    const onDay = reminders![1]!;
    expect(new Date(onDay.remind_at).toISOString()).toBe(new Date(`${due}T00:00:00Z`).toISOString());

    // One second before 08:00 Manila on the due date: not yet; at 08:00: queued.
    const before = new Date(Date.parse(onDay.remind_at) - 1000).toISOString();
    await withDb((c) => c.query("select private.enqueue_due_reminders($1::timestamptz)", [before]));
    expect((await admin().from("reminders").select("status").eq("id", onDay.id).single()).data?.status).toBe(
      "scheduled",
    );
    await withDb((c) => c.query("select private.enqueue_due_reminders($1::timestamptz)", [onDay.remind_at]));
    expect((await admin().from("reminders").select("status").eq("id", onDay.id).single()).data?.status).toBe("queued");

    const deliver = () =>
      withDb(async (c) => (await c.query("select private.deliver_reminder($1) as n", [onDay.id])).rows[0].n as number);
    expect(await deliver()).toBe(2); // owner + member (registry.view); guest excluded
    expect(await deliver()).toBe(0); // already sent
    // A redelivered queue message (status reset) still can't duplicate notifications.
    await withDb((c) => c.query("update public.reminders set status = 'queued' where id = $1", [onDay.id]));
    expect(await deliver()).toBe(0);
    const { count } = await admin()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("reminder_id", onDay.id);
    expect(count).toBe(2);

    // Changing the date cancels the stale reminder.
    await admin()
      .from("assets")
      .update({ warranty_expires_on: addDays(today, 30) })
      .eq("id", asset!.id);
    await sync();
    const first = (await admin().from("reminders").select("status, cancel_reason").eq("id", reminders![0]!.id).single())
      .data;
    expect(first).toMatchObject({ status: "cancelled", cancel_reason: "source_changed" });
  });

  it("booking reminders follow reschedules and are cancelled (with pending emails) when the booking is cancelled", async () => {
    const start = futureSlot(9, 11);
    const { bookingId } = unwrap(
      await requestBooking(owner.ctx, {
        householdId: household,
        serviceId: provider.serviceId,
        propertyId: property,
        start: toManilaLocal(start),
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    const reminders = async () =>
      (
        await admin()
          .from("reminders")
          .select("id, status, cancel_reason, remind_at, due_at")
          .eq("source_id", bookingId)
          .order("created_at")
      ).data ?? [];
    let rows = await reminders();
    expect(rows).toHaveLength(1);
    expect(Date.parse(rows[0]!.remind_at)).toBe(Date.parse(start) - 24 * 3_600_000);

    const newStart = futureSlot(10, 14);
    unwrap(await rescheduleBooking(owner.ctx, { bookingId, start: toManilaLocal(newStart), reason: "Conflict" }));
    rows = await reminders();
    expect(rows.map((r) => r.status)).toEqual(["cancelled", "scheduled"]);
    expect(rows[0]!.cancel_reason).toBe("source_changed");

    // Deliver the reminder early (email queued for owner), then cancel the booking.
    const live = rows[1]!;
    await withDb(async (c) => {
      await c.query("update public.reminders set status = 'queued' where id = $1", [live.id]);
      await c.query("select private.deliver_reminder($1)", [live.id]);
    });
    const { data: notes } = await admin()
      .from("notifications")
      .select("id")
      .eq("reminder_id", live.id)
      .eq("recipient_id", owner.id);
    expect(await delivery(notes![0]!.id, "email")).toMatchObject({ status: "queued" });
    unwrap(await transitionBooking(owner.ctx, { bookingId, action: "cancel", reason: "No longer needed" }));
    expect(await delivery(notes![0]!.id, "email")).toMatchObject({ status: "cancelled" });

    const { bookingId: second } = unwrap(
      await requestBooking(owner.ctx, {
        householdId: household,
        serviceId: provider.serviceId,
        propertyId: property,
        start: toManilaLocal(futureSlot(12, 9)),
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    unwrap(await transitionBooking(owner.ctx, { bookingId: second, action: "cancel", reason: "Plans changed" }));
    const cancelled = (await admin().from("reminders").select("status, cancel_reason").eq("source_id", second).single())
      .data;
    expect(cancelled).toMatchObject({ status: "cancelled", cancel_reason: "booking_cancelled" });
  });
});

describe("unified calendar", () => {
  it("places timed items on their Manila date across month boundaries", async () => {
    const month = shiftMonth(manilaDateOf(new Date()).slice(0, 7), 2);
    const firstDay = `${month}-01`;
    // 00:30 Manila on the 1st is 16:30 UTC on the previous day.
    const { bookingId } = unwrap(
      await requestBooking(owner.ctx, {
        householdId: household,
        serviceId: provider.serviceId,
        propertyId: property,
        start: `${firstDay}T00:30`,
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    const inMonth = unwrap(await listCalendarItems(owner.ctx, [household], monthRange(month)));
    const previous = unwrap(await listCalendarItems(owner.ctx, [household], monthRange(shiftMonth(month, -1))));
    expect(inMonth.find((i) => i.itemKey === `booking:${bookingId}`)?.startsAt).toBeTruthy();
    expect(previous.some((i) => i.itemKey === `booking:${bookingId}`)).toBe(false);
  });

  it("filters by category and member, and assignment is limited to members with permission", async () => {
    const month = shiftMonth(manilaDateOf(new Date()).slice(0, 7), 3);
    const { bookingId } = unwrap(
      await requestBooking(owner.ctx, {
        householdId: household,
        serviceId: provider.serviceId,
        propertyId: property,
        start: `${month}-15T10:00`,
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    const key = `booking:${bookingId}`;
    const range = monthRange(month);
    // Bookings default to the person who booked.
    expect(
      unwrap(await listCalendarItems(owner.ctx, [household], range, { member: owner.id })).some(
        (i) => i.itemKey === key,
      ),
    ).toBe(true);
    unwrap(await assignCalendarItem(member.ctx, { householdId: household, itemKey: key, userId: member.id }));
    expect(
      unwrap(await listCalendarItems(owner.ctx, [household], range, { member: member.id })).some(
        (i) => i.itemKey === key,
      ),
    ).toBe(true);
    expect(
      unwrap(await listCalendarItems(owner.ctx, [household], range, { category: "bills" })).some(
        (i) => i.itemKey === key,
      ),
    ).toBe(false);

    const byGuest = await assignCalendarItem(guest.ctx, { householdId: household, itemKey: key, userId: guest.id });
    expect(byGuest.ok || byGuest.error.code).toBe("FORBIDDEN");
    const toOutsider = await assignCalendarItem(owner.ctx, {
      householdId: household,
      itemKey: key,
      userId: outsider.id,
    });
    expect(toOutsider.ok).toBe(false);
  });

  it("RLS: outsiders see nothing; guests don't see bills, registry or bookings", async () => {
    const range = { from: manilaDateOf(new Date()), to: addDays(manilaDateOf(new Date()), 400) };
    expect(unwrap(await listCalendarItems(outsider.ctx, [household], range))).toEqual([]);
    expect(unwrap(await listCalendarItems(guest.ctx, [household], range))).toEqual([]);
    expect(unwrap(await listCalendarItems(owner.ctx, [household], range)).length).toBeGreaterThan(0);
  });

  it("RLS: users only read their own notifications and deliveries, and cannot forge them", async () => {
    await notify(owner, "bill.reminder", `rls:${crypto.randomUUID()}`);
    const { data: others } = await outsider.client.from("notifications").select("id").eq("recipient_id", owner.id);
    expect(others).toEqual([]);
    const { data: deliveries } = await outsider.client
      .from("notification_deliveries")
      .select("id")
      .eq("recipient_id", owner.id);
    expect(deliveries).toEqual([]);
    const { data: mine } = await owner.client.from("notifications").select("id").limit(1);
    const forge = await owner.client
      .from("notification_deliveries")
      .insert({ notification_id: mine![0]!.id, recipient_id: owner.id, channel: "sms", status: "sent" });
    expect(forge.error).not.toBeNull();
    const edit = await owner.client
      .from("notifications")
      .update({ title: "Forged" })
      .eq("id", mine![0]!.id)
      .select("id");
    expect(edit.error).not.toBeNull();
    const { data: guestReminders } = await guest.client.from("reminders").select("id").eq("household_id", household);
    expect(guestReminders).toEqual([]);
  });
});

describe("urgent provider discovery", () => {
  let available: string;
  let unavailable: string;
  let stale: string;
  let notUrgent: string;
  let elsewhere: string;

  beforeAll(async () => {
    const make = async (
      label: string,
      opts: { urgent: boolean; status: "available" | "unavailable"; city: string; updatedHoursAgo?: number },
    ) => {
      const user = await createTestUser(`nt-urgent-${label}`);
      const p = await createListedProvider(user, { name: `Urgent ${label}` });
      await admin()
        .from("service_areas")
        .insert({ organization_id: p.orgId, province: "Metro Manila", city_municipality: opts.city });
      await admin()
        .from("provider_profiles")
        .update({ accepts_urgent: opts.urgent, availability_status: opts.status, phone: "+63 917 555 0100" })
        .eq("organization_id", p.orgId);
      if (opts.updatedHoursAgo !== undefined) {
        await withDb((c) =>
          c.query(
            "update public.provider_profiles set availability_updated_at = now() - make_interval(hours => $2) where organization_id = $1",
            [p.orgId, opts.updatedHoursAgo],
          ),
        );
      }
      return p.orgId;
    };
    available = await make("fresh", { urgent: true, status: "available", city: "Pasig", updatedHoursAgo: 1 });
    stale = await make("stale", { urgent: true, status: "available", city: "Pasig", updatedHoursAgo: 72 });
    unavailable = await make("off", { urgent: true, status: "unavailable", city: "Pasig", updatedHoursAgo: 1 });
    notUrgent = await make("regular", { urgent: false, status: "available", city: "Pasig", updatedHoursAgo: 1 });
    elsewhere = await make("cebu", { urgent: true, status: "available", city: "Cebu City", updatedHoursAgo: 1 });
  });

  it("lists available urgent providers in the area, fresh first, and flags stale availability", async () => {
    const r = unwrap(
      await searchUrgentProviders(owner.ctx, { category: "plumbing", province: "Metro Manila", city: "Pasig" }),
    );
    const ids = r.available.map((p) => p.organizationId);
    expect(ids.indexOf(available)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(stale)).toBeGreaterThan(ids.indexOf(available));
    expect(r.available.find((p) => p.organizationId === available)).toMatchObject({
      isStale: false,
      phone: "+63 917 555 0100",
      areaLabel: "Pasig, Metro Manila",
    });
    expect(r.available.find((p) => p.organizationId === stale)?.isStale).toBe(true);
    expect(r.available.find((p) => p.organizationId === available)?.verifiedItems).toContain("business_registration");
  });

  it("separates unavailable providers and excludes non-urgent or out-of-area ones", async () => {
    const r = unwrap(
      await searchUrgentProviders(owner.ctx, { category: "plumbing", province: "Metro Manila", city: "Pasig" }),
    );
    const all = [...r.available, ...r.unavailable].map((p) => p.organizationId);
    expect(r.unavailable.map((p) => p.organizationId)).toContain(unavailable);
    expect(r.available.map((p) => p.organizationId)).not.toContain(unavailable);
    expect(all).not.toContain(notUrgent);
    expect(all).not.toContain(elsewhere);
  });

  it("returns nothing when no provider matches the category or area", async () => {
    expect(
      unwrap(
        await searchUrgentProviders(owner.ctx, { category: "locksmith", province: "Metro Manila", city: "Pasig" }),
      ).available.filter((p) => [available, stale].includes(p.organizationId)),
    ).toEqual([]);
    const far = unwrap(
      await searchUrgentProviders(owner.ctx, { category: "plumbing", province: "Benguet", city: "Baguio" }),
    );
    expect(
      [...far.available, ...far.unavailable].filter((p) => [available, stale, unavailable].includes(p.organizationId)),
    ).toEqual([]);
    expect((await searchUrgentProviders(owner.ctx, { category: "aircon", province: "Metro Manila" })).ok).toBe(false);
  });
});
