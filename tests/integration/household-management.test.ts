import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptHouseholdInvitation,
  createHousehold,
  getHouseholdOverview,
  inviteHouseholdMember,
  listHouseholdActivity,
  listHouseholdInvitations,
  listHouseholdMembers,
  removeHouseholdMember,
} from "@bahayplus/modules/households";
import {
  archiveProperty,
  createProperty,
  getProperty,
  listProperties,
  restoreProperty,
  setDefaultProperty,
  updateProperty,
} from "@bahayplus/modules/properties";
import { loadHouseholdAccess } from "@bahayplus/modules/authorization";
import { adminClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

const property = (householdId: string, name: string, extra: Record<string, unknown> = {}) => ({
  householdId,
  name,
  propertyType: "house",
  cityMunicipality: "Quezon City",
  province: "Metro Manila",
  ...extra,
});

async function join(owner: TestUser, householdId: string, user: TestUser, role: string) {
  const invite = unwrap(await inviteHouseholdMember(owner.ctx, { householdId, email: user.email, role }));
  unwrap(await acceptHouseholdInvitation(user.ctx, { token: invite.token }));
}

let owner: TestUser;
let household: string;

beforeAll(async () => {
  owner = await createTestUser("hm-owner");
  household = unwrap(await createHousehold(owner.ctx, { name: "Management test" })).householdId;
});
afterAll(cleanupTestUsers);

describe("household with no properties", () => {
  it("reports zero properties and no default, without errors", async () => {
    const access = unwrap(await loadHouseholdAccess(owner.ctx, household));
    const overview = unwrap(await getHouseholdOverview(owner.ctx, access));
    expect(overview).toMatchObject({
      activeProperties: 0,
      archivedProperties: 0,
      activeMembers: 1,
      defaultPropertyId: null,
    });
    expect(unwrap(await listProperties(owner.ctx, household))).toEqual([]);
  });
});

describe("multiple properties and the default property", () => {
  let first: string;
  let second: string;

  it("makes the first property the default automatically", async () => {
    first = unwrap(await createProperty(owner.ctx, property(household, "Family home"))).propertyId;
    second = unwrap(
      await createProperty(owner.ctx, property(household, "Condo", { propertyType: "condominium" })),
    ).propertyId;
    const list = unwrap(await listProperties(owner.ctx, household));
    expect(list.map((p) => [p.name, p.isDefault])).toEqual([
      ["Family home", true],
      ["Condo", false],
    ]);
  });

  it("switches the default property", async () => {
    unwrap(await setDefaultProperty(owner.ctx, { householdId: household, propertyId: second }));
    expect(unwrap(await getProperty(owner.ctx, second)).isDefault).toBe(true);
    expect(unwrap(await getProperty(owner.ctx, first)).isDefault).toBe(false);
  });

  it("archiving the default clears it; archived properties cannot become default", async () => {
    unwrap(await archiveProperty(owner.ctx, { propertyId: second }));
    const archived = unwrap(await getProperty(owner.ctx, second));
    expect(archived).toMatchObject({ isDefault: false, isActive: false });
    expect(archived.archivedAt).not.toBeNull();
    const setArchived = await setDefaultProperty(owner.ctx, { householdId: household, propertyId: second });
    expect(setArchived.ok || setArchived.error.reason).toBe("property_archived");
    expect(unwrap(await listProperties(owner.ctx, household)).map((p) => p.name)).toEqual(["Family home"]);
  });

  it("archived properties stay referenced and readable but read-only, and can be restored", async () => {
    const edit = await updateProperty(owner.ctx, {
      ...property(household, "Renamed"),
      householdId: undefined,
      propertyId: second,
    });
    expect(edit.ok).toBe(false);
    const history = unwrap(await listHouseholdActivity(owner.ctx, household, { propertyId: second, limit: 20 }));
    expect(history.map((h) => h.kind)).toEqual(expect.arrayContaining(["property.created", "property.archived"]));
    unwrap(await restoreProperty(owner.ctx, { propertyId: second }));
    expect(unwrap(await getProperty(owner.ctx, second))).toMatchObject({ isActive: true, archivedAt: null });
  });

  it("rejects a default property from another household (composite FK)", async () => {
    const other = await createTestUser("hm-other");
    const otherHousehold = unwrap(await createHousehold(other.ctx, { name: "Other" })).householdId;
    const foreign = unwrap(await createProperty(other.ctx, property(otherHousehold, "Foreign"))).propertyId;
    const viaService = await setDefaultProperty(owner.ctx, { householdId: household, propertyId: foreign });
    expect(viaService.ok).toBe(false);
    const viaService2 = await adminClient()
      .from("households")
      .update({ default_property_id: foreign })
      .eq("id", household);
    expect(viaService2.error?.code).toBe("23503"); // even the service role cannot cross households
  });

  it("properties cannot be moved to another household", async () => {
    const other = await createTestUser("hm-mover");
    const otherHousehold = unwrap(await createHousehold(other.ctx, { name: "Destination" })).householdId;
    const { error } = await adminClient().from("properties").update({ household_id: otherHousehold }).eq("id", first);
    expect(error?.message).toBe("forbidden");
  });
});

describe("unauthorized property edits", () => {
  let member: TestUser;
  let guest: TestUser;
  let limited: TestUser;
  let target: string;

  beforeAll(async () => {
    [member, guest, limited] = await Promise.all([
      createTestUser("hm-member"),
      createTestUser("hm-guest"),
      createTestUser("hm-limited"),
    ]);
    await join(owner, household, member, "member");
    await join(owner, household, guest, "guest");
    await join(owner, household, limited, "limited");
    target = unwrap(await listProperties(owner.ctx, household))[0]!.id;
  });

  it("members and limited members can read but not change properties", async () => {
    for (const user of [member, limited]) {
      expect(unwrap(await listProperties(user.ctx, household)).length).toBeGreaterThan(0);
      expect((await createProperty(user.ctx, property(household, "Sneaky"))).ok).toBe(false);
      expect(
        (
          await updateProperty(user.ctx, {
            ...property(household, "Hacked"),
            householdId: undefined,
            propertyId: target,
          })
        ).ok,
      ).toBe(false);
      expect((await archiveProperty(user.ctx, { propertyId: target })).ok).toBe(false);
      expect((await setDefaultProperty(user.ctx, { householdId: household, propertyId: target })).ok).toBe(false);
    }
    expect(unwrap(await getProperty(owner.ctx, target)).name).toBe("Family home");
  });

  it("guests see household basics only — no properties, members or invitations", async () => {
    expect(unwrap(await listProperties(guest.ctx, household))).toEqual([]);
    const access = unwrap(await loadHouseholdAccess(guest.ctx, household));
    const overview = unwrap(await getHouseholdOverview(guest.ctx, access));
    expect(overview).toMatchObject({ activeProperties: null, activeMembers: null, pendingInvitations: null });
    const activity = unwrap(await listHouseholdActivity(guest.ctx, household, { limit: 50 }));
    expect(activity.every((a) => a.kind.startsWith("household."))).toBe(true);
  });

  it("limited members see property activity but not member activity", async () => {
    const activity = unwrap(await listHouseholdActivity(limited.ctx, household, { limit: 50 }));
    expect(activity.some((a) => a.kind.startsWith("property."))).toBe(true);
    expect(activity.some((a) => a.kind.startsWith("member.") || a.kind.startsWith("invitation."))).toBe(false);
  });
});

describe("invitations and member removal", () => {
  it("rejects duplicates, reports expired invitations, and records removals", async () => {
    const email = `dup-${Date.now()}@bahayplus.test`;
    unwrap(await inviteHouseholdMember(owner.ctx, { householdId: household, email, role: "guest" }));
    const dup = await inviteHouseholdMember(owner.ctx, { householdId: household, email, role: "guest" });
    expect(dup.ok || dup.error.reason).toBe("duplicate_invitation");

    const expiring = unwrap(
      await inviteHouseholdMember(owner.ctx, {
        householdId: household,
        email: `exp-${Date.now()}@bahayplus.test`,
        role: "guest",
      }),
    );
    await adminClient()
      .from("household_invitations")
      .update({
        created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        expires_at: new Date(Date.now() - 1_000).toISOString(),
      })
      .eq("id", expiring.invitationId);
    const listed = unwrap(await listHouseholdInvitations(owner.ctx, household));
    expect(listed.find((i) => i.id === expiring.invitationId)?.status).toBe("expired");
    // A fresh invitation to an email whose previous one expired is allowed.
    const reinvite = await inviteHouseholdMember(owner.ctx, {
      householdId: household,
      email: listed.find((i) => i.id === expiring.invitationId)!.email,
      role: "guest",
    });
    expect(reinvite.ok).toBe(true);

    const leaver = await createTestUser("hm-leaver");
    await join(owner, household, leaver, "member");
    const members = unwrap(await listHouseholdMembers(owner.ctx, household));
    unwrap(await removeHouseholdMember(owner.ctx, { memberId: members.find((m) => m.userId === leaver.id)!.id }));
    expect(unwrap(await listHouseholdMembers(owner.ctx, household)).some((m) => m.userId === leaver.id)).toBe(false);
    const activity = unwrap(await listHouseholdActivity(owner.ctx, household, { limit: 20 }));
    expect(activity.find((a) => a.kind === "member.removed")?.text).toContain("Test hm-leaver");
  });
});

describe("multiple households", () => {
  it("keeps properties separate per household for the same user", async () => {
    const second = unwrap(await createHousehold(owner.ctx, { name: "Second home" })).householdId;
    unwrap(
      await createProperty(
        owner.ctx,
        property(second, "Beach house", { province: "Batangas", cityMunicipality: "Nasugbu" }),
      ),
    );
    const a = unwrap(await listProperties(owner.ctx, household)).map((p) => p.name);
    const b = unwrap(await listProperties(owner.ctx, second)).map((p) => p.name);
    expect(b).toEqual(["Beach house"]);
    expect(a).not.toContain("Beach house");
  });
});
