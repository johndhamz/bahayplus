import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptHouseholdInvitation, createHousehold, inviteHouseholdMember } from "@bahayplus/modules/households";
import { archiveProperty, createProperty } from "@bahayplus/modules/properties";
import {
  addAssetServiceRecord,
  archiveAsset,
  createAsset,
  getAsset,
  listAssets,
  listAssetServiceRecords,
  restoreAsset,
} from "@bahayplus/modules/assets";
import { addPetHealthRecord, createPet, listPetHealthRecords, listPets, setPetPhoto } from "@bahayplus/modules/pets";
import { addVehicleServiceRecord, createVehicle, getVehicle, listVehicles } from "@bahayplus/modules/vehicles";
import { deleteFile, listFiles, prepareUpload, registerFile } from "@bahayplus/modules/files";
import { listDueItems } from "@bahayplus/modules/scheduling";
import { adminClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj<<>>endobj\n");
const FAKE_JPEG = new TextEncoder().encode("this is definitely not an image, just text pretending");

async function upload(
  user: TestUser,
  args: {
    householdId: string;
    entityType: "asset" | "pet" | "pet_health" | "vehicle";
    entityId: string;
    bytes: Uint8Array;
    contentType: string;
    purpose?: string;
  },
) {
  const prepared = await prepareUpload(user.ctx, {
    householdId: args.householdId,
    entityType: args.entityType,
    entityId: args.entityId,
    purpose: args.purpose ?? "photo",
    fileName: "test.bin",
    contentType: args.contentType,
    sizeBytes: args.bytes.length,
  });
  if (!prepared.ok) return { prepared };
  const put = await user.client.storage
    .from("household-files")
    .upload(prepared.value.objectPath, args.bytes, { contentType: args.contentType });
  if (put.error) return { prepared, put };
  const registered = await registerFile(user.ctx, {
    householdId: args.householdId,
    entityType: args.entityType,
    entityId: args.entityId,
    purpose: args.purpose ?? "photo",
    fileName: "test.bin",
    contentType: args.contentType,
    sizeBytes: args.bytes.length,
    objectPath: prepared.value.objectPath,
  });
  return { prepared, put, registered, objectPath: prepared.value.objectPath };
}

let alice: TestUser; // owner of A
let bob: TestUser; // owner of B
let limited: TestUser; // limited member of A
let guest: TestUser; // guest of A
let householdA: string;
let householdB: string;
let propertyA: string;
let assetA: string;
let petA: string;
let vehicleA: string;

beforeAll(async () => {
  [alice, bob, limited, guest] = await Promise.all([
    createTestUser("reg-alice"),
    createTestUser("reg-bob"),
    createTestUser("reg-limited"),
    createTestUser("reg-guest"),
  ]);
  householdA = unwrap(await createHousehold(alice.ctx, { name: "Registry A" })).householdId;
  householdB = unwrap(await createHousehold(bob.ctx, { name: "Registry B" })).householdId;
  for (const [user, role] of [
    [limited, "limited"],
    [guest, "guest"],
  ] as const) {
    const inv = unwrap(await inviteHouseholdMember(alice.ctx, { householdId: householdA, email: user.email, role }));
    unwrap(await acceptHouseholdInvitation(user.ctx, { token: inv.token }));
  }
  propertyA = unwrap(
    await createProperty(alice.ctx, {
      householdId: householdA,
      name: "Home",
      propertyType: "house",
      cityMunicipality: "Pasig",
      province: "Metro Manila",
    }),
  ).propertyId;
  assetA = unwrap(
    await createAsset(alice.ctx, {
      householdId: householdA,
      propertyId: propertyA,
      name: "Sala aircon",
      category: "aircon",
      purchaseDate: "2026-01-31",
      purchasePriceCentavos: "32,999.50",
      warrantyExpiresOn: "2027-01-31",
      maintenanceIntervalMonths: "1",
    }),
  ).assetId;
  petA = unwrap(await createPet(alice.ctx, { householdId: householdA, name: "Bantay", species: "dog" })).petId;
  vehicleA = unwrap(
    await createVehicle(alice.ctx, {
      householdId: householdA,
      vehicleType: "car",
      make: "Toyota",
      model: "Vios",
      year: "2020",
      plateNumber: "abc  1234",
      registrationExpiresOn: "2026-11-30",
    }),
  ).vehicleId;
});
afterAll(cleanupTestUsers);

describe("money and normalisation", () => {
  it("stores purchase price as exact centavos and plates normalised", async () => {
    expect(unwrap(await getAsset(alice.ctx, assetA)).purchasePriceCentavos).toBe(3_299_950);
    expect(unwrap(await getVehicle(alice.ctx, vehicleA)).plateNumber).toBe("ABC 1234");
    const duplicate = await createVehicle(alice.ctx, {
      householdId: householdA,
      vehicleType: "car",
      make: "Honda",
      model: "City",
      plateNumber: "ABC 1234",
    });
    expect(duplicate.ok || duplicate.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("cross-household isolation", () => {
  it("household B cannot read A's registry", async () => {
    expect(unwrap(await listAssets(bob.ctx, householdA))).toEqual([]);
    expect(unwrap(await listPets(bob.ctx, householdA))).toEqual([]);
    expect(unwrap(await listVehicles(bob.ctx, householdA))).toEqual([]);
    expect(unwrap(await listDueItems(bob.ctx, householdA, { horizonDays: 3650 }))).toEqual([]);
    expect((await getAsset(bob.ctx, assetA)).ok).toBe(false);
  });

  it("household B cannot write into A or link records to A's items", async () => {
    expect((await createAsset(bob.ctx, { householdId: householdA, name: "Planted", category: "other" })).ok).toBe(
      false,
    );
    expect(
      (await addAssetServiceRecord(bob.ctx, { assetId: assetA, servicedOn: "2026-10-01", kind: "repair" })).ok,
    ).toBe(false);
    // Direct inserts: pointing a record in B at A's asset fails the composite FK; claiming A fails RLS.
    const crossFk = await bob.client
      .from("asset_service_records")
      .insert({ asset_id: assetA, household_id: householdB, serviced_on: "2026-10-01", kind: "repair" });
    expect(crossFk.error).not.toBeNull();
    const claimA = await bob.client
      .from("pet_health_records")
      .insert({ pet_id: petA, household_id: householdA, kind: "vaccination", title: "x", occurred_on: "2026-10-01" });
    expect(claimA.error?.code).toBe("42501");
    const crossVehicle = await bob.client
      .from("vehicle_service_records")
      .insert({ vehicle_id: vehicleA, household_id: householdB, serviced_on: "2026-10-01", kind: "repair" });
    expect(crossVehicle.error).not.toBeNull();
  });

  it("an asset can only reference a property of its own household", async () => {
    const result = await createAsset(bob.ctx, {
      householdId: householdB,
      propertyId: propertyA,
      name: "Sneaky",
      category: "other",
    });
    expect(result.ok || result.error.code).toBe("VALIDATION_FAILED");
  });

  it("ownership columns cannot be changed to move items between households", async () => {
    const move = await alice.client
      .from("assets")
      .update({ household_id: householdB } as never)
      .eq("id", assetA);
    expect(move.error?.code).toBe("42501");
  });
});

describe("sensitive veterinary records", () => {
  it("limited members see grooming but not vaccinations; guests see neither", async () => {
    unwrap(
      await addPetHealthRecord(alice.ctx, {
        petId: petA,
        kind: "vaccination",
        title: "Anti-rabies",
        occurredOn: "2026-01-10",
        nextDueOn: "2027-01-10",
      }),
    );
    unwrap(
      await addPetHealthRecord(alice.ctx, {
        petId: petA,
        kind: "grooming",
        title: "Bath & trim",
        occurredOn: "2026-10-01",
      }),
    );
    expect(
      unwrap(await listPetHealthRecords(alice.ctx, petA))
        .map((r) => r.kind)
        .sort(),
    ).toEqual(["grooming", "vaccination"]);
    expect(unwrap(await listPetHealthRecords(limited.ctx, petA)).map((r) => r.kind)).toEqual(["grooming"]);
    expect(unwrap(await listPetHealthRecords(guest.ctx, petA))).toEqual([]);
    expect(unwrap(await listPets(guest.ctx, householdA))).toEqual([]);
    const limitedVax = await addPetHealthRecord(limited.ctx, {
      petId: petA,
      kind: "vaccination",
      title: "5-in-1",
      occurredOn: "2026-10-01",
    });
    expect(limitedVax.ok).toBe(false);
  });
});

describe("warranty and maintenance due items", () => {
  it("computes warranty expiry and month-end-clamped maintenance due dates", async () => {
    const items = unwrap(await listDueItems(alice.ctx, householdA, { horizonDays: 3650, today: "2026-10-25" }));
    const forAsset = items.filter((i) => i.subjectId === assetA);
    expect(forAsset.find((i) => i.dueKind === "warranty_expiry")?.dueOn).toBe("2027-01-31");
    // Purchased Jan 31 with a 1-month interval and no service yet → Feb 28 (2026 is not a leap year).
    expect(forAsset.find((i) => i.dueKind === "asset_maintenance")).toMatchObject({
      dueOn: "2026-02-28",
      status: "overdue",
    });
    expect(items.find((i) => i.dueKind === "vehicle_registration")).toMatchObject({
      dueOn: "2026-11-30",
      status: "upcoming",
    });
  });

  it("servicing the asset moves the next maintenance date", async () => {
    unwrap(
      await addAssetServiceRecord(alice.ctx, {
        assetId: assetA,
        servicedOn: "2026-10-20",
        kind: "cleaning",
        costCentavos: "1500",
      }),
    );
    expect(unwrap(await getAsset(alice.ctx, assetA)).lastMaintainedOn).toBe("2026-10-20");
    const items = unwrap(await listDueItems(alice.ctx, householdA, { horizonDays: 3650, today: "2026-10-25" }));
    expect(items.find((i) => i.subjectId === assetA && i.dueKind === "asset_maintenance")).toMatchObject({
      dueOn: "2026-11-20",
      status: "due_soon",
    });
  });

  it("only the latest record per vaccine drives the next due date", async () => {
    unwrap(
      await addPetHealthRecord(alice.ctx, {
        petId: petA,
        kind: "vaccination",
        title: "anti-rabies",
        occurredOn: "2027-01-09",
        nextDueOn: "2028-01-09",
      }),
    );
    const rabies = unwrap(await listDueItems(alice.ctx, householdA, { horizonDays: 3650, today: "2026-10-25" })).filter(
      (i) => i.dueKind === "pet_vaccination",
    );
    expect(rabies.map((i) => i.dueOn)).toEqual(["2028-01-09"]);
  });

  it("vehicle service records update mileage and maintenance anchors", async () => {
    unwrap(
      await addVehicleServiceRecord(alice.ctx, {
        vehicleId: vehicleA,
        servicedOn: "2026-09-01",
        odometerKm: "45,210",
        kind: "oil_change",
      }),
    );
    expect(unwrap(await getVehicle(alice.ctx, vehicleA))).toMatchObject({
      mileageKm: 45210,
      lastMaintainedOn: "2026-09-01",
      lastMaintainedKm: 45210,
    });
  });
});

describe("asset archival and archived property references", () => {
  it("archived assets leave lists and due items but keep their history", async () => {
    unwrap(await archiveAsset(alice.ctx, { assetId: assetA }));
    expect(unwrap(await listAssets(alice.ctx, householdA)).some((a) => a.id === assetA)).toBe(false);
    expect(
      unwrap(await listAssets(alice.ctx, householdA, { includeArchived: true })).some((a) => a.id === assetA),
    ).toBe(true);
    expect(
      unwrap(await listDueItems(alice.ctx, householdA, { horizonDays: 3650 })).some((i) => i.subjectId === assetA),
    ).toBe(false);
    expect(unwrap(await listAssetServiceRecords(alice.ctx, assetA)).length).toBe(1);
    const blocked = await addAssetServiceRecord(alice.ctx, {
      assetId: assetA,
      servicedOn: "2026-10-21",
      kind: "repair",
    });
    expect(blocked.ok || blocked.error.reason).toBe("archived");
    unwrap(await restoreAsset(alice.ctx, { assetId: assetA }));
  });

  it("archiving a property keeps existing items linked but blocks new ones", async () => {
    unwrap(await archiveProperty(alice.ctx, { propertyId: propertyA }));
    expect(unwrap(await getAsset(alice.ctx, assetA)).propertyId).toBe(propertyA);
    const fresh = await createAsset(alice.ctx, {
      householdId: householdA,
      propertyId: propertyA,
      name: "New TV",
      category: "electronics",
    });
    expect(fresh.ok || fresh.error.reason).toBe("property_archived");
  });
});

describe("file uploads and access", () => {
  let assetFilePath: string;
  let vetFilePath: string;

  it("accepts a real JPEG and PDF and returns signed URLs only", async () => {
    const photo = await upload(alice, {
      householdId: householdA,
      entityType: "asset",
      entityId: assetA,
      bytes: JPEG,
      contentType: "image/jpeg",
    });
    expect(photo.registered?.ok).toBe(true);
    assetFilePath = photo.objectPath!;
    const vaccine = unwrap(await listPetHealthRecords(alice.ctx, petA)).find((r) => r.kind === "vaccination")!;
    const vet = await upload(alice, {
      householdId: householdA,
      entityType: "pet_health",
      entityId: vaccine.id,
      bytes: PDF,
      contentType: "application/pdf",
      purpose: "vet_record",
    });
    expect(vet.registered?.ok).toBe(true);
    vetFilePath = vet.objectPath!;
    const files = unwrap(await listFiles(alice.ctx, "asset", assetA));
    expect(files[0]!.url).toMatch(/\/storage\/v1\/object\/sign\/household-files\//);
  });

  it("rejects disallowed types and oversize files at the bucket", async () => {
    const text = await upload(alice, {
      householdId: householdA,
      entityType: "asset",
      entityId: assetA,
      bytes: FAKE_JPEG,
      contentType: "text/plain",
    });
    expect(text.prepared.ok).toBe(false); // contract refuses before any upload
    const path = `${householdA}/asset/${assetA}/${crypto.randomUUID()}.txt`;
    const direct = await alice.client.storage
      .from("household-files")
      .upload(path, FAKE_JPEG, { contentType: "text/plain" });
    expect(direct.error).not.toBeNull();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(JPEG);
    const tooBig = await alice.client.storage
      .from("household-files")
      .upload(`${householdA}/asset/${assetA}/${crypto.randomUUID()}.jpg`, big, { contentType: "image/jpeg" });
    expect(tooBig.error).not.toBeNull();
  });

  it("rejects content that doesn't match the declared type and removes the object", async () => {
    const fake = await upload(alice, {
      householdId: householdA,
      entityType: "asset",
      entityId: assetA,
      bytes: FAKE_JPEG,
      contentType: "image/jpeg",
    });
    expect(fake.put?.error).toBeFalsy();
    expect(fake.registered?.ok).toBe(false);
    const gone = await adminClient().storage.from("household-files").download(fake.objectPath!);
    expect(gone.error).not.toBeNull();
  });

  it("cannot write outside your household or register someone else's path", async () => {
    const intoA = await bob.client.storage
      .from("household-files")
      .upload(`${householdA}/asset/${assetA}/${crypto.randomUUID()}.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(intoA.error).not.toBeNull();
    const malformed = await alice.client.storage
      .from("household-files")
      .upload(`${householdA}/${crypto.randomUUID()}.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(malformed.error).not.toBeNull();
    const steal = await registerFile(bob.ctx, {
      householdId: householdB,
      entityType: "asset",
      entityId: assetA,
      purpose: "photo",
      fileName: "x.jpg",
      contentType: "image/jpeg",
      sizeBytes: JPEG.length,
      objectPath: assetFilePath,
    });
    expect(steal.ok).toBe(false);
  });

  it("other households, guests and limited members cannot read protected files", async () => {
    expect((await bob.client.storage.from("household-files").download(assetFilePath)).error).not.toBeNull();
    expect((await bob.client.storage.from("household-files").createSignedUrl(assetFilePath, 60)).error).not.toBeNull();
    expect(unwrap(await listFiles(bob.ctx, "asset", assetA))).toEqual([]);
    expect((await guest.client.storage.from("household-files").download(assetFilePath)).error).not.toBeNull();
    // Limited members may see registry files but not veterinary records.
    expect((await limited.client.storage.from("household-files").download(assetFilePath)).error).toBeNull();
    expect((await limited.client.storage.from("household-files").download(vetFilePath)).error).not.toBeNull();
  });

  it("pet photos must be images uploaded for that pet; deleting a file removes the object", async () => {
    const photo = await upload(alice, {
      householdId: householdA,
      entityType: "pet",
      entityId: petA,
      bytes: JPEG,
      contentType: "image/jpeg",
    });
    const fileId = unwrap(photo.registered!).fileId;
    unwrap(await setPetPhoto(alice.ctx, { petId: petA, fileId }));
    const assetFile = unwrap(await listFiles(alice.ctx, "asset", assetA))[0]!;
    const wrong = await setPetPhoto(alice.ctx, { petId: petA, fileId: assetFile.id });
    expect(wrong.ok).toBe(false);
    unwrap(await deleteFile(alice.ctx, { fileId: assetFile.id }));
    expect((await adminClient().storage.from("household-files").download(assetFilePath)).error).not.toBeNull();
  });
});
