import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getAdminOverview,
  listDisputes,
  listUsersForAdmin,
  saveCategory,
  setOrganizationStatus,
  setUserSuspension,
  updateDispute,
  updatePlatformSetting,
} from "@bahayplus/modules/admin";
import { listMyContexts, loadOrganizationAccess } from "@bahayplus/modules/authorization";
import {
  assignWorkOrder,
  confirmBookingCompletion,
  createWorkOrder,
  getWorkOrder,
  getWorkOrderLocation,
  listBookings,
  listWorkOrders,
  requestBooking,
  toggleChecklistItem,
  updateWorkOrderStatus,
} from "@bahayplus/modules/bookings";
import { prepareUpload } from "@bahayplus/modules/files";
import { createHousehold } from "@bahayplus/modules/households";
import {
  acceptOrganizationInvitation,
  createOrganization,
  inviteOrganizationMember,
} from "@bahayplus/modules/organizations";
import { createProperty } from "@bahayplus/modules/properties";
import { decideVerification, startVerificationReview, submitVerification } from "@bahayplus/modules/providers";
import {
  cancelPurchaseOrder,
  createProduct,
  createPurchaseOrder,
  decidePurchaseOrder,
  getPurchaseOrder,
  listProducts,
  listPurchaseOrders,
  shipPurchaseOrder,
  updateDelivery,
  updateSupplierProfile,
} from "@bahayplus/modules/suppliers";
import { listInventory, listStockMovements, recordStockMovement } from "@bahayplus/modules/inventory";
import { withDb } from "../support/db";
import { createListedProvider, futureSlot, toManilaLocal } from "../support/marketplace";
import { adminClient, anonClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}
const reasonOf = (r: { ok: boolean; error?: { reason?: string; code?: string } }) =>
  r.ok ? "ok" : (r.error?.reason ?? r.error?.code);

let providerA: { orgId: string; serviceId: string };
let providerB: { orgId: string; serviceId: string };
let supplierC: string;
let supplierD: string;
let ownerA: TestUser;
let ownerB: TestUser;
let ownerC: TestUser;
let ownerD: TestUser;
let multi: TestUser; // worker in A, staff in B, owner? no — staff in supplier C
let workerA2: TestUser;
let customer: TestUser;
let household: string;
let property: string;
let superAdmin: TestUser;
let operations: TestUser;
let support: TestUser;
let nobody: TestUser;
let productPipe: string;
let productBreaker: string;

async function join(owner: TestUser, orgId: string, user: TestUser, role: "manager" | "staff" | "worker") {
  const inv = unwrap(await inviteOrganizationMember(owner.ctx, { organizationId: orgId, email: user.email, role }));
  unwrap(await acceptOrganizationInvitation(user.ctx, { token: inv.token }));
}

async function grantPlatform(user: TestUser, role: "super_admin" | "operations" | "support") {
  await withDb((c) =>
    c.query(
      "insert into public.platform_admins (user_id, role_id) select $1, id from public.roles where scope = 'platform' and key = $2",
      [user.id, role],
    ),
  );
}

async function auditCount(action: string, targetId: string) {
  return withDb(async (c) =>
    Number(
      (await c.query("select count(*) from public.audit_logs where action = $1 and target_id = $2", [action, targetId]))
        .rows[0].count,
    ),
  );
}

async function makeSupplier(owner: TestUser, name: string, published: boolean) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const orgId = unwrap(await createOrganization(owner.ctx, { kind: "supplier", name, slug })).organizationId;
  unwrap(
    await updateSupplierProfile(owner.ctx, {
      organizationId: orgId,
      description: "Test supplier",
      phone: "",
      email: "",
      address: "Caloocan",
      deliveryAreas: "Metro Manila",
      minOrderCentavos: "100",
      isPublished: published,
    }),
  );
  return orgId;
}

beforeAll(async () => {
  [ownerA, ownerB, ownerC, ownerD, multi, workerA2, customer, superAdmin, operations, support, nobody] =
    (await Promise.all(
      [
        "op-owner-a",
        "op-owner-b",
        "op-owner-c",
        "op-owner-d",
        "op-multi",
        "op-worker2",
        "op-customer",
        "op-super",
        "op-ops",
        "op-support",
        "op-nobody",
      ].map((l) => createTestUser(l)),
    )) as [
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
    ];
  providerA = await createListedProvider(ownerA, { name: "Ops Provider A", capacity: 5, durationMinutes: 60 });
  providerB = await createListedProvider(ownerB, { name: "Ops Provider B", capacity: 5 });
  supplierC = await makeSupplier(ownerC, "Ops Supplier C", true);
  supplierD = await makeSupplier(ownerD, "Ops Supplier D", false);
  await join(ownerA, providerA.orgId, multi, "worker");
  await join(ownerA, providerA.orgId, workerA2, "worker");
  await join(ownerB, providerB.orgId, multi, "staff");
  await join(ownerC, supplierC, multi, "staff");
  household = unwrap(await createHousehold(customer.ctx, { name: "Ops household" })).householdId;
  property = unwrap(
    await createProperty(customer.ctx, {
      householdId: household,
      name: "Home",
      propertyType: "house",
      addressLine: "9 Molave St.",
      cityMunicipality: "Pasig",
      province: "Metro Manila",
    }),
  ).propertyId;
  productPipe = unwrap(
    await createProduct(ownerC.ctx, {
      organizationId: supplierC,
      sku: "PIPE-1",
      name: "PVC pipe",
      unit: "pc",
      unitPriceCentavos: "150",
      reorderLevel: "2",
    }),
  ).productId;
  productBreaker = unwrap(
    await createProduct(ownerC.ctx, {
      organizationId: supplierC,
      sku: "BRK-1",
      name: "Breaker",
      unit: "pc",
      unitPriceCentavos: "400",
    }),
  ).productId;
  unwrap(
    await recordStockMovement(ownerC.ctx, {
      productId: productPipe,
      quantity: "10",
      reason: "receipt",
      note: "",
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  unwrap(
    await recordStockMovement(ownerC.ctx, {
      productId: productBreaker,
      quantity: "3",
      reason: "receipt",
      note: "",
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  await createProduct(ownerD.ctx, {
    organizationId: supplierD,
    sku: "SECRET-1",
    name: "Unlisted item",
    unit: "pc",
    unitPriceCentavos: "10",
  });
  await grantPlatform(superAdmin, "super_admin");
  await grantPlatform(operations, "operations");
  await grantPlatform(support, "support");
});
afterAll(async () => {
  await withDb((c) =>
    c.query("delete from public.platform_admins where user_id = any($1)", [[superAdmin.id, operations.id, support.id]]),
  );
  await cleanupTestUsers();
});

describe("role and organization switching", () => {
  it("one account carries a different role per organization, from the same membership system", async () => {
    const contexts = unwrap(await listMyContexts(multi.ctx));
    const roles = Object.fromEntries(contexts.filter((c) => c.kind === "organization").map((c) => [c.id, c.roleKey]));
    expect(roles).toMatchObject({ [providerA.orgId]: "worker", [providerB.orgId]: "staff", [supplierC]: "staff" });
    const inA = unwrap(await loadOrganizationAccess(multi.ctx, providerA.orgId));
    const inB = unwrap(await loadOrganizationAccess(multi.ctx, providerB.orgId));
    expect(inA.permissions.has("bookings.view")).toBe(false);
    expect(inA.permissions.has("work_orders.perform")).toBe(true);
    expect(inB.permissions.has("bookings.view")).toBe(true);
    expect(inB.permissions.has("purchasing.manage")).toBe(true);
    expect((await loadOrganizationAccess(multi.ctx, supplierD)).ok).toBe(false);
  });

  it("permissions follow the organization being acted on", async () => {
    // Staff in B can order for B; the same person as a worker in A cannot order for A.
    const forB = await createPurchaseOrder(multi.ctx, {
      buyerOrgId: providerB.orgId,
      supplierOrgId: supplierC,
      lines: [{ productId: productPipe, quantity: "1" }],
      deliveryAddress: "B warehouse, Pasig",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(forB.ok).toBe(true);
    const forA = await createPurchaseOrder(multi.ctx, {
      buyerOrgId: providerA.orgId,
      supplierOrgId: supplierC,
      lines: [{ productId: productPipe, quantity: "1" }],
      deliveryAddress: "A warehouse, Pasig",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(reasonOf(forA)).toBe("forbidden");
    // As worker in A they see no bookings; as staff in B they do (even if empty).
    expect(unwrap(await listBookings(multi.ctx, { organizationId: providerA.orgId }))).toEqual([]);
    expect((await listBookings(multi.ctx, { organizationId: providerB.orgId })).ok).toBe(true);
    if (forB.ok)
      unwrap(
        await cancelPurchaseOrder(multi.ctx, { purchaseOrderId: forB.value.purchaseOrderId, reason: "Test cleanup" }),
      );
  });
});

describe("worker assignment visibility", () => {
  let workOrderId: string;
  let bookingId: string;

  beforeAll(async () => {
    bookingId = unwrap(
      await requestBooking(customer.ctx, {
        householdId: household,
        serviceId: providerA.serviceId,
        propertyId: property,
        start: toManilaLocal(futureSlot(4, 9)),
        idempotencyKey: crypto.randomUUID(),
      }),
    ).bookingId;
    workOrderId = unwrap(
      await createWorkOrder(ownerA.ctx, {
        bookingId,
        title: "Fix leak",
        instructions: "Bring washers",
        checklist: ["Photo before"],
      }),
    ).workOrderId;
    unwrap(await assignWorkOrder(ownerA.ctx, { workOrderId, workerId: multi.id }));
  });

  it("the assigned worker sees the job and its address; another worker in the same company does not", async () => {
    expect(unwrap(await getWorkOrder(multi.ctx, workOrderId)).title).toBe("Fix leak");
    expect(unwrap(await getWorkOrderLocation(multi.ctx, workOrderId))?.address).toContain("9 Molave St.");
    expect(unwrap(await listWorkOrders(multi.ctx, { assignedToMe: true })).map((w) => w.id)).toContain(workOrderId);

    expect((await getWorkOrder(workerA2.ctx, workOrderId)).ok).toBe(false);
    expect(unwrap(await getWorkOrderLocation(workerA2.ctx, workOrderId))).toBeNull();
    expect(unwrap(await listWorkOrders(workerA2.ctx, { organizationId: providerA.orgId }))).toEqual([]);
    expect(reasonOf(await updateWorkOrderStatus(workerA2.ctx, { workOrderId, status: "en_route" }))).toBe("not_found");
    const item = unwrap(await getWorkOrder(multi.ctx, workOrderId)).checklist[0]!;
    expect(reasonOf(await toggleChecklistItem(workerA2.ctx, { itemId: item.id, done: true }))).toBe("not_found");
    const upload = await prepareUpload(workerA2.ctx, {
      householdId: household,
      entityType: "work_order",
      entityId: workOrderId,
      purpose: "after_photo",
      fileName: "a.jpg",
      contentType: "image/jpeg",
      sizeBytes: 100,
    });
    expect(upload.ok).toBe(false);
  });

  it("workers can't see the household or other bookings, and can't cancel", async () => {
    const { data: households } = await multi.client.from("households").select("id").eq("id", household);
    expect(households).toEqual([]);
    const { data: properties } = await multi.client.from("properties").select("id").eq("household_id", household);
    expect(properties).toEqual([]);
    expect(reasonOf(await updateWorkOrderStatus(multi.ctx, { workOrderId, status: "cancelled" }))).toBe("forbidden");
  });

  it("completion needs the checklist and evidence; the worker keeps their job history afterwards", async () => {
    unwrap(await updateWorkOrderStatus(multi.ctx, { workOrderId, status: "in_progress" }));
    const item = unwrap(await getWorkOrder(multi.ctx, workOrderId)).checklist[0]!;
    unwrap(await toggleChecklistItem(multi.ctx, { itemId: item.id, done: true }));
    expect(reasonOf(await updateWorkOrderStatus(multi.ctx, { workOrderId, status: "completed", notes: "" }))).toBe(
      "evidence_required",
    );
    // A registered "after" photo counts as evidence.
    const prep = unwrap(
      await prepareUpload(multi.ctx, {
        householdId: household,
        entityType: "work_order",
        entityId: workOrderId,
        purpose: "after_photo",
        fileName: "after.jpg",
        contentType: "image/jpeg",
        sizeBytes: 100,
      }),
    );
    expect(prep.objectPath.startsWith(`${household}/work_order/${workOrderId}/`)).toBe(true);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
    const up = await multi.client.storage
      .from("household-files")
      .upload(prep.objectPath, jpeg, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    const { error: fileError } = await multi.client.from("files").insert({
      household_id: household,
      object_path: prep.objectPath,
      entity_type: "work_order",
      entity_id: workOrderId,
      purpose: "after_photo",
      file_name: "after.jpg",
      content_type: "image/jpeg",
      size_bytes: jpeg.length,
    });
    expect(fileError).toBeNull();
    unwrap(await updateWorkOrderStatus(multi.ctx, { workOrderId, status: "completed", notes: "" }));
    expect(unwrap(await getWorkOrder(multi.ctx, workOrderId)).status).toBe("completed");
    // The customer can read the evidence too (shared record).
    const { data: customerFiles } = await customer.client.from("files").select("id").eq("entity_id", workOrderId);
    expect(customerFiles).toHaveLength(1);
  });
});

describe("supplier inventory isolation", () => {
  it("suppliers can't see each other's stock or unpublished catalogs", async () => {
    expect(unwrap(await listStockMovements(ownerD.ctx, supplierC))).toEqual([]);
    expect(unwrap(await listInventory(ownerD.ctx, supplierC))).toEqual([]);
    expect(unwrap(await listProducts(ownerC.ctx, supplierD))).toEqual([]);
    expect(
      reasonOf(
        await recordStockMovement(ownerD.ctx, {
          productId: productPipe,
          quantity: "-5",
          reason: "adjustment",
          note: "",
          idempotencyKey: crypto.randomUUID(),
        }),
      ),
    ).toBe("not_found");
  });

  it("buyers see a listed supplier's products and prices, never its stock ledger", async () => {
    expect(unwrap(await listProducts(ownerB.ctx, supplierC)).map((p) => p.sku)).toEqual(
      expect.arrayContaining(["PIPE-1", "BRK-1"]),
    );
    expect(unwrap(await listStockMovements(ownerB.ctx, supplierC))).toEqual([]);
    const { data } = await ownerB.client.from("product_inventory").select("on_hand").eq("product_id", productPipe);
    expect(data).toEqual([]);
  });

  it("suppliers never see households, bookings or provider-only data", async () => {
    for (const table of ["households", "bookings", "properties", "work_orders", "service_requests"] as const) {
      const { data } = await ownerC.client.from(table).select("id").limit(5);
      expect(data, table).toEqual([]);
    }
    expect(unwrap(await listPurchaseOrders(ownerD.ctx, { supplierOrgId: supplierC }))).toEqual([]);
  });
});

describe("purchase order lifecycle", () => {
  it("submit → accept (reserves) → ship (deducts) → failed → re-attempt → buyer confirms receipt", async () => {
    const key = crypto.randomUUID();
    const input = {
      buyerOrgId: providerB.orgId,
      supplierOrgId: supplierC,
      lines: [
        { productId: productPipe, quantity: "4" },
        { productId: productBreaker, quantity: "2" },
      ],
      deliveryAddress: "B warehouse, Pasig",
      idempotencyKey: key,
    };
    const { purchaseOrderId: id } = unwrap(await createPurchaseOrder(ownerB.ctx, input));
    expect(unwrap(await createPurchaseOrder(ownerB.ctx, input)).purchaseOrderId).toBe(id); // idempotent
    const po = unwrap(await getPurchaseOrder(ownerC.ctx, id));
    expect(po).toMatchObject({
      status: "submitted",
      totalCentavos: 4 * 15000 + 2 * 40000,
      buyerName: "Ops Provider B",
    });

    expect(
      reasonOf(await decidePurchaseOrder(ownerB.ctx, { purchaseOrderId: id, decision: "accepted", note: "" })),
    ).toBe("not_found");
    unwrap(await decidePurchaseOrder(ownerC.ctx, { purchaseOrderId: id, decision: "accepted", note: "" }));
    const inv = () =>
      listInventory(ownerC.ctx, supplierC).then((r) => Object.fromEntries(unwrap(r).map((x) => [x.sku, x])));
    expect((await inv())["PIPE-1"]).toMatchObject({ onHand: 10, reserved: 4 });

    unwrap(await shipPurchaseOrder(ownerC.ctx, { purchaseOrderId: id, courier: "Own truck", trackingRef: "NAB 1234" }));
    expect((await inv())["PIPE-1"]).toMatchObject({ onHand: 6, reserved: 0 });
    expect(reasonOf(await cancelPurchaseOrder(ownerB.ctx, { purchaseOrderId: id, reason: "Too late" }))).toBe(
      "invalid_transition",
    );

    expect(reasonOf(await updateDelivery(ownerC.ctx, { purchaseOrderId: id, status: "failed", detail: "" }))).toBe(
      "invalid_input",
    );
    unwrap(await updateDelivery(ownerC.ctx, { purchaseOrderId: id, status: "failed", detail: "Gate closed" }));
    unwrap(await updateDelivery(ownerC.ctx, { purchaseOrderId: id, status: "out_for_delivery", detail: "" }));
    unwrap(await updateDelivery(ownerB.ctx, { purchaseOrderId: id, status: "delivered", detail: "Jun (warehouse)" }));
    const done = unwrap(await getPurchaseOrder(ownerB.ctx, id));
    expect(done.status).toBe("delivered");
    expect(done.delivery).toMatchObject({ status: "delivered", attempts: 2, receivedBy: "Jun (warehouse)" });
  });

  it("refuses to oversell, enforces minimums, requires reasons and respects listing", async () => {
    // Breakers: 3 received − 2 shipped = 1 available.
    const big = unwrap(
      await createPurchaseOrder(ownerB.ctx, {
        buyerOrgId: providerB.orgId,
        supplierOrgId: supplierC,
        lines: [{ productId: productBreaker, quantity: "2" }],
        deliveryAddress: "B warehouse, Pasig",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).purchaseOrderId;
    expect(
      reasonOf(await decidePurchaseOrder(ownerC.ctx, { purchaseOrderId: big, decision: "accepted", note: "" })),
    ).toBe("insufficient_stock");
    expect(
      reasonOf(await decidePurchaseOrder(ownerC.ctx, { purchaseOrderId: big, decision: "rejected", note: "" })),
    ).toBe("invalid_input");
    unwrap(await decidePurchaseOrder(ownerC.ctx, { purchaseOrderId: big, decision: "rejected", note: "Only 1 left" }));

    // Stock can't be adjusted below what accepted orders reserve.
    const one = unwrap(
      await createPurchaseOrder(ownerB.ctx, {
        buyerOrgId: providerB.orgId,
        supplierOrgId: supplierC,
        lines: [{ productId: productBreaker, quantity: "1" }],
        deliveryAddress: "B warehouse, Pasig",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).purchaseOrderId;
    unwrap(await decidePurchaseOrder(ownerC.ctx, { purchaseOrderId: one, decision: "accepted", note: "" }));
    expect(
      reasonOf(
        await recordStockMovement(ownerC.ctx, {
          productId: productBreaker,
          quantity: "-1",
          reason: "adjustment",
          note: "count",
          idempotencyKey: crypto.randomUUID(),
        }),
      ),
    ).toBe("insufficient_stock");
    unwrap(await cancelPurchaseOrder(ownerC.ctx, { purchaseOrderId: one, reason: "Supplier cancelled" }));
    expect(unwrap(await getPurchaseOrder(ownerB.ctx, one))).toMatchObject({
      status: "cancelled",
      cancelledBy: "supplier",
    });

    const small = await createPurchaseOrder(ownerB.ctx, {
      buyerOrgId: providerB.orgId,
      supplierOrgId: supplierC,
      lines: [{ productId: productPipe, quantity: "0.001" }],
      deliveryAddress: "B warehouse, Pasig",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(reasonOf(small)).toBe("invalid_input"); // below the ₱100 minimum
    const unlisted = await createPurchaseOrder(ownerB.ctx, {
      buyerOrgId: providerB.orgId,
      supplierOrgId: supplierD,
      lines: [{ productId: productPipe, quantity: "1" }],
      deliveryAddress: "B warehouse, Pasig",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(reasonOf(unlisted)).toBe("not_found");
    // Stock adjustments are audited.
    unwrap(
      await recordStockMovement(ownerC.ctx, {
        productId: productPipe,
        quantity: "-1",
        reason: "adjustment",
        note: "damaged",
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    expect(await auditCount("inventory.adjusted", productPipe)).toBeGreaterThanOrEqual(1);
  });
});

describe("platform administration", () => {
  it("non-admins are refused every admin command", async () => {
    expect(reasonOf(await getAdminOverview(nobody.ctx))).toBe("forbidden");
    expect(reasonOf(await listUsersForAdmin(nobody.ctx))).toBe("forbidden");
    expect(
      reasonOf(
        await setOrganizationStatus(nobody.ctx, {
          organizationId: providerA.orgId,
          status: "suspended",
          reason: "Hostile takeover",
        }),
      ),
    ).toBe("forbidden");
    expect(
      reasonOf(await setUserSuspension(nobody.ctx, { userId: customer.id, suspend: true, reason: "Hostile takeover" })),
    ).toBe("forbidden");
    expect(reasonOf(await updatePlatformSetting(nobody.ctx, { key: "maintenance_banner", value: "hacked" }))).toBe(
      "forbidden",
    );
    const { data: audit } = await nobody.client.from("audit_logs").select("id").limit(1);
    expect(audit).toEqual([]);
  });

  it("support is read-mostly: masked emails, no suspensions, no categories, no settings, no verification decisions", async () => {
    const users = unwrap(await listUsersForAdmin(support.ctx, { search: "Test op-customer" }));
    const me = users.find((u) => u.id === customer.id);
    expect(me?.email).toMatch(/^.•••@bahayplus\.test$/);
    expect(
      reasonOf(await setUserSuspension(support.ctx, { userId: customer.id, suspend: true, reason: "Testing support" })),
    ).toBe("forbidden");
    expect(
      reasonOf(
        await setOrganizationStatus(support.ctx, {
          organizationId: providerA.orgId,
          status: "suspended",
          reason: "Testing support",
        }),
      ),
    ).toBe("forbidden");
    expect(
      reasonOf(await saveCategory(support.ctx, { division: "home", slug: `support-${Date.now()}`, name: "Nope" })),
    ).toBe("forbidden");
    expect(reasonOf(await updatePlatformSetting(support.ctx, { key: "urgent_stale_hours", value: 12 }))).toBe(
      "forbidden",
    );
    const fresh = await createTestUser("op-verify");
    const p = await createListedProvider(fresh, { name: "Verify Me" });
    const requestId = unwrap(
      await submitVerification(fresh.ctx, {
        organizationId: p.orgId,
        items: [{ itemType: "business_registration", referenceNumber: "DTI-1" }],
      }),
    ).requestId;
    expect(reasonOf(await startVerificationReview(support.ctx, { requestId }))).toBe("forbidden");
    unwrap(await startVerificationReview(operations.ctx, { requestId }));
    expect(
      reasonOf(
        await decideVerification(support.ctx, {
          requestId,
          decision: "rejected",
          items: [],
          decisionNotes: "x",
          internalNotes: "",
          expiresOn: "",
        }),
      ),
    ).toBe("forbidden");
  });

  it("operations can suspend organizations (audited, members lose access); only super admins suspend users", async () => {
    unwrap(
      await setOrganizationStatus(operations.ctx, {
        organizationId: providerA.orgId,
        status: "suspended",
        reason: "Fraud report under review",
      }),
    );
    expect(await auditCount("platform.organization_suspended", providerA.orgId)).toBe(1);
    expect((await loadOrganizationAccess(ownerA.ctx, providerA.orgId)).ok).toBe(false);
    unwrap(
      await setOrganizationStatus(operations.ctx, {
        organizationId: providerA.orgId,
        status: "active",
        reason: "Report cleared",
      }),
    );
    expect((await loadOrganizationAccess(ownerA.ctx, providerA.orgId)).ok).toBe(true);

    expect(
      reasonOf(await setUserSuspension(operations.ctx, { userId: nobody.id, suspend: true, reason: "Spam account" })),
    ).toBe("forbidden");
    expect(
      reasonOf(
        await setUserSuspension(superAdmin.ctx, { userId: superAdmin.id, suspend: true, reason: "Oops myself" }),
      ),
    ).toBe("invalid_input");
    unwrap(await setUserSuspension(superAdmin.ctx, { userId: nobody.id, suspend: true, reason: "Spam account" }));
    expect(await auditCount("platform.user_suspended", nobody.id)).toBe(1);
    const signIn = await anonClient().auth.signInWithPassword({ email: nobody.email, password: nobody.password });
    expect(signIn.error).not.toBeNull();
    unwrap(await setUserSuspension(superAdmin.ctx, { userId: nobody.id, suspend: false, reason: "Appeal granted" }));
    expect(
      (await anonClient().auth.signInWithPassword({ email: nobody.email, password: nobody.password })).error,
    ).toBeNull();
    expect(unwrap(await listUsersForAdmin(superAdmin.ctx, { search: nobody.email }))[0]?.email).toBe(nobody.email);
  });

  it("categories and settings changes are permission-checked and audited", async () => {
    const slug = `ops-cat-${Date.now().toString(36)}`;
    const { categoryId } = unwrap(
      await saveCategory(operations.ctx, {
        division: "home",
        slug,
        name: "Water tank cleaning",
        urgentEligible: false,
      }),
    );
    expect(await auditCount("platform.category_created", categoryId)).toBe(1);
    expect(reasonOf(await saveCategory(operations.ctx, { division: "home", slug, name: "Duplicate" }))).toBe(
      "conflict",
    );
    expect(reasonOf(await updatePlatformSetting(operations.ctx, { key: "maintenance_banner", value: "x" }))).toBe(
      "forbidden",
    );
    unwrap(await updatePlatformSetting(superAdmin.ctx, { key: "urgent_stale_hours", value: 36 }));
    expect((await updatePlatformSetting(superAdmin.ctx, { key: "urgent_stale_hours", value: 500 })).ok).toBe(false);
    const audits = await withDb((c) =>
      c.query("select metadata from public.audit_logs where action = 'platform.setting_changed' and actor_id = $1", [
        superAdmin.id,
      ]),
    );
    expect(audits.rows.some((r) => r.metadata.key === "urgent_stale_hours")).toBe(true);
    unwrap(await updatePlatformSetting(superAdmin.ctx, { key: "urgent_stale_hours", value: 24 }));
    await withDb((c) => c.query("update public.service_categories set is_active = false where id = $1", [categoryId]));
  });

  it("a disputed completion opens a dispute that operations resolve, notifying both sides", async () => {
    const { bookingId } = unwrap(
      await requestBooking(customer.ctx, {
        householdId: household,
        serviceId: providerB.serviceId,
        propertyId: property,
        start: toManilaLocal(futureSlot(6, 10)),
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    await adminClient()
      .from("bookings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", bookingId);
    unwrap(await confirmBookingCompletion(customer.ctx, { bookingId, outcome: "disputed", note: "Leak is back" }));
    const dispute = unwrap(await listDisputes(operations.ctx, { open: true })).find((d) => d.bookingId === bookingId)!;
    expect(dispute).toMatchObject({ status: "open", reason: "Leak is back" });
    expect(unwrap(await listDisputes(ownerA.ctx)).some((d) => d.id === dispute.id)).toBe(false);
    expect(reasonOf(await updateDispute(support.ctx, { disputeId: dispute.id, action: "take" }))).toBe("forbidden");
    unwrap(await updateDispute(operations.ctx, { disputeId: dispute.id, action: "take" }));
    expect(
      reasonOf(await updateDispute(operations.ctx, { disputeId: dispute.id, action: "resolved", resolution: "" })),
    ).toBe("invalid_input");
    unwrap(
      await updateDispute(operations.ctx, {
        disputeId: dispute.id,
        action: "resolved",
        resolution: "Provider will return free of charge.",
      }),
    );
    expect(await auditCount("platform.dispute_resolved", dispute.id)).toBe(1);
    const { count } = await adminClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", ownerB.id)
      .like("dedupe_key", `dispute:${dispute.id}:%`);
    expect(count).toBe(1);
  });
});
