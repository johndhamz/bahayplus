import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptHouseholdInvitation,
  changeHouseholdMemberRole,
  createHousehold,
  getHouseholdInvitation,
  inviteHouseholdMember,
  listHouseholdInvitations,
  listHouseholdMembers,
  removeHouseholdMember,
  revokeHouseholdInvitation,
  setHouseholdMemberStatus,
  updateHousehold,
} from "@bahayplus/modules/households";
import {
  acceptOrganizationInvitation,
  createOrganization,
  inviteOrganizationMember,
  listOrganizationMembers,
} from "@bahayplus/modules/organizations";
import { listMyContexts, loadHouseholdAccess, loadOrganizationAccess } from "@bahayplus/modules/authorization";
import {
  adminClient,
  anonClient,
  cleanupTestUsers,
  createTestUser,
  verifySecondFactor,
  type TestUser,
} from "../support/supabase";

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

async function newHousehold(owner: TestUser, name = "Test household") {
  return unwrap(await createHousehold(owner.ctx, { name })).householdId;
}

/** Owner invites `user` with `role`; `user` accepts. Returns the new member id. */
async function addMember(owner: TestUser, householdId: string, user: TestUser, role: string) {
  const invite = unwrap(await inviteHouseholdMember(owner.ctx, { householdId, email: user.email, role }));
  unwrap(await acceptHouseholdInvitation(user.ctx, { token: invite.token }));
  const members = unwrap(await listHouseholdMembers(owner.ctx, householdId));
  return members.find((m) => m.userId === user.id)!.id;
}

let alice: TestUser; // owns household A
let bob: TestUser; // owns household B
let householdA: string;
let householdB: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser("alice"), createTestUser("bob")]);
  [householdA, householdB] = await Promise.all([newHousehold(alice, "Household A"), newHousehold(bob, "Household B")]);
  const insertA = await alice.client
    .from("properties")
    .insert({ household_id: householdA, name: "A house", property_type: "house" });
  const insertB = await bob.client
    .from("properties")
    .insert({ household_id: householdB, name: "B condo", property_type: "condominium" });
  expect(insertA.error).toBeNull();
  expect(insertB.error).toBeNull();
});

afterAll(cleanupTestUsers);

describe("1 · household isolation", () => {
  it("a member of household A cannot read household B or its data", async () => {
    const households = await alice.client.from("households").select("id").eq("id", householdB);
    expect(households.data).toEqual([]);
    const members = await alice.client.from("household_members").select("id").eq("household_id", householdB);
    expect(members.data).toEqual([]);
    const properties = await alice.client.from("properties").select("id").eq("household_id", householdB);
    expect(properties.data).toEqual([]);
    const invitations = await alice.client.from("household_invitations").select("id").eq("household_id", householdB);
    expect(invitations.data).toEqual([]);
  });

  it("a member of household A cannot write to household B", async () => {
    const update = await updateHousehold(alice.ctx, { householdId: householdB, name: "Hijacked" });
    expect(update.ok).toBe(false);
    const insert = await alice.client
      .from("properties")
      .insert({ household_id: householdB, name: "Planted", property_type: "house" });
    expect(insert.error?.code).toBe("42501");
    const propertyUpdate = await alice.client
      .from("properties")
      .update({ name: "x" })
      .eq("household_id", householdB)
      .select("id");
    expect(propertyUpdate.data).toEqual([]);
    const invite = await inviteHouseholdMember(alice.ctx, {
      householdId: householdB,
      email: "x@bahayplus.test",
      role: "guest",
    });
    expect(invite.ok || invite.error.code).toBe("NOT_FOUND");
    const name = await adminClient().from("households").select("name").eq("id", householdB).single();
    expect(name.data?.name).toBe("Household B");
  });

  it("resolving a foreign household context returns NOT_FOUND (no existence leak)", async () => {
    const access = await loadHouseholdAccess(alice.ctx, householdB);
    expect(access.ok || access.error.code).toBe("NOT_FOUND");
  });
});

describe("2 · organization isolation", () => {
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    orgA = unwrap(
      await createOrganization(alice.ctx, {
        kind: "service_provider",
        name: "Alpha Plumbing",
        slug: `alpha-${Date.now()}`,
      }),
    ).organizationId;
    orgB = unwrap(
      await createOrganization(bob.ctx, { kind: "supplier", name: "Bravo Supplies", slug: `bravo-${Date.now()}` }),
    ).organizationId;
  });

  it("members of organization A cannot read organization B", async () => {
    expect((await alice.client.from("organizations").select("id").eq("id", orgB)).data).toEqual([]);
    expect((await alice.client.from("organization_members").select("id").eq("organization_id", orgB)).data).toEqual([]);
    expect((await alice.client.from("organization_invitations").select("id").eq("organization_id", orgB)).data).toEqual(
      [],
    );
    const access = await loadOrganizationAccess(alice.ctx, orgB);
    expect(access.ok || access.error.code).toBe("NOT_FOUND");
  });

  it("members of organization A cannot modify organization B", async () => {
    const update = await alice.client.from("organizations").update({ name: "Hijacked" }).eq("id", orgB).select("id");
    expect(update.data).toEqual([]);
    const invite = await inviteOrganizationMember(alice.ctx, {
      organizationId: orgB,
      email: "x@bahayplus.test",
      role: "staff",
    });
    expect(invite.ok || invite.error.code).toBe("NOT_FOUND");
    const statusChange = await alice.client
      .from("organizations")
      .update({ status: "suspended" } as never)
      .eq("id", orgA);
    expect(statusChange.error?.code).toBe("42501"); // status is platform-controlled: no column privilege
  });

  it("household membership grants nothing in organizations and vice versa", async () => {
    const members = unwrap(await listOrganizationMembers(alice.ctx, orgA));
    expect(members.map((m) => m.userId)).toEqual([alice.id]);
    expect((await bob.client.from("households").select("id").eq("id", householdA)).data).toEqual([]);
  });
});

describe("3 · privilege escalation is prevented", () => {
  let household: string;
  let manager: TestUser;
  let member: TestUser;
  let managerId: string;
  let memberId: string;

  beforeAll(async () => {
    [manager, member] = await Promise.all([createTestUser("manager"), createTestUser("member")]);
    household = await newHousehold(alice, "Escalation test");
    managerId = await addMember(alice, household, manager, "manager");
    memberId = await addMember(alice, household, member, "member");
  });

  it("a member cannot raise their own role or anyone else's", async () => {
    const self = await changeHouseholdMemberRole(member.ctx, { memberId, role: "owner" });
    expect(self.ok || self.error.code).toBe("FORBIDDEN");
    const other = await changeHouseholdMemberRole(member.ctx, { memberId: managerId, role: "guest" });
    expect(other.ok || other.error.code).toBe("FORBIDDEN");
  });

  it("a manager cannot make themselves or others owner, nor grant manager", async () => {
    for (const [target, role] of [
      [managerId, "owner"],
      [memberId, "owner"],
      [memberId, "manager"],
    ] as const) {
      const result = await changeHouseholdMemberRole(manager.ctx, { memberId: target, role });
      expect(result.ok, `${role}`).toBe(false);
      if (!result.ok) expect(["role_escalation", "forbidden"]).toContain(result.error.reason);
    }
    const invite = await inviteHouseholdMember(manager.ctx, {
      householdId: household,
      email: "boss@bahayplus.test",
      role: "owner",
    });
    expect(invite.ok || invite.error.reason).toBe("role_escalation");
  });

  it("a manager can manage lower roles only", async () => {
    expect((await changeHouseholdMemberRole(manager.ctx, { memberId, role: "limited" })).ok).toBe(true);
    expect((await changeHouseholdMemberRole(manager.ctx, { memberId, role: "member" })).ok).toBe(true);
  });

  it("direct table writes to memberships, roles and platform admins are rejected", async () => {
    const memberRole = await member.client
      .from("roles")
      .select("id")
      .eq("scope", "household")
      .eq("key", "owner")
      .single();
    const directUpdate = await member.client
      .from("household_members")
      .update({ role_id: memberRole.data!.id })
      .eq("id", memberId)
      .select("id");
    expect(directUpdate.data ?? []).toEqual([]);
    const directInsert = await member.client
      .from("household_members")
      .insert({ household_id: householdB, user_id: member.id, role_id: memberRole.data!.id });
    expect(directInsert.error).not.toBeNull();
    const superAdmin = await member.client
      .from("roles")
      .select("id")
      .eq("scope", "platform")
      .eq("key", "super_admin")
      .single();
    const selfAdmin = await member.client
      .from("platform_admins")
      .insert({ user_id: member.id, role_id: superAdmin.data!.id });
    expect(selfAdmin.error).not.toBeNull();
    const roleEdit = await member.client.from("roles").update({ rank: 100 }).eq("key", "member").select("id");
    expect(roleEdit.data ?? []).toEqual([]);
    const grant = await member.client
      .from("role_permissions")
      .insert({ role_id: memberRole.data!.id, permission_id: memberRole.data!.id });
    expect(grant.error).not.toBeNull();
    const { data: still } = await adminClient()
      .from("household_members")
      .select("roles(key)")
      .eq("id", memberId)
      .single();
    expect(still?.roles?.key).toBe("member");
    expect((await adminClient().from("platform_admins").select("user_id").eq("user_id", member.id)).data).toEqual([]);
  });

  it("profile updates cannot touch protected columns", async () => {
    const result = await member.client
      .from("profiles")
      .update({ id: alice.id } as never)
      .eq("id", member.id);
    expect(result.error?.code).toBe("42501");
  });

  it("the last owner cannot leave, be demoted or be suspended", async () => {
    const owners = unwrap(await listHouseholdMembers(alice.ctx, household)).filter((m) => m.role === "owner");
    expect(owners).toHaveLength(1);
    const ownerId = owners[0]!.id;
    const leave = await removeHouseholdMember(alice.ctx, { memberId: ownerId });
    expect(leave.ok || leave.error.reason).toBe("last_owner");
    const demote = await changeHouseholdMemberRole(alice.ctx, { memberId: ownerId, role: "member" });
    expect(demote.ok || demote.error.reason).toBe("last_owner");
    // Even the service role cannot remove the last owner.
    const serviceDelete = await adminClient().from("household_members").delete().eq("id", ownerId);
    expect(serviceDelete.error?.message).toBe("last_owner");
  });

  it("with two owners, one may step down; then the other is the last owner", async () => {
    const coOwner = await createTestUser("coowner");
    const coOwnerId = await addMember(alice, household, coOwner, "owner");
    const aliceId = unwrap(await listHouseholdMembers(alice.ctx, household)).find((m) => m.userId === alice.id)!.id;
    expect((await changeHouseholdMemberRole(alice.ctx, { memberId: aliceId, role: "manager" })).ok).toBe(true);
    const lastLeave = await removeHouseholdMember(coOwner.ctx, { memberId: coOwnerId });
    expect(lastLeave.ok || lastLeave.error.reason).toBe("last_owner");
    // Restore Alice as owner for the remaining tests.
    expect((await changeHouseholdMemberRole(coOwner.ctx, { memberId: aliceId, role: "owner" })).ok).toBe(true);
  });
});

describe("4 · unauthenticated access", () => {
  it("anonymous clients see no tenant data and cannot call commands", async () => {
    const anon = anonClient();
    for (const table of [
      "households",
      "household_members",
      "properties",
      "organizations",
      "profiles",
      "audit_logs",
    ] as const) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    const create = await anon.rpc("create_household", { p_name: "Anon home" });
    expect(create.error).not.toBeNull();
  });
});

describe("5 · revoked members lose access immediately", () => {
  it("removed members can no longer read the household", async () => {
    const carol = await createTestUser("carol");
    const household = await newHousehold(alice, "Revocation test");
    const carolMemberId = await addMember(alice, household, carol, "member");
    expect((await carol.client.from("households").select("id").eq("id", household)).data).toHaveLength(1);

    expect((await removeHouseholdMember(alice.ctx, { memberId: carolMemberId })).ok).toBe(true);
    expect((await carol.client.from("households").select("id").eq("id", household)).data).toEqual([]);
    expect((await carol.client.from("properties").select("id").eq("household_id", household)).data).toEqual([]);
    const access = await loadHouseholdAccess(carol.ctx, household);
    expect(access.ok).toBe(false);
  });

  it("suspended members lose access and regain it when reactivated", async () => {
    const dan = await createTestUser("dan");
    const household = await newHousehold(alice, "Suspension test");
    const danId = await addMember(alice, household, dan, "member");
    expect((await setHouseholdMemberStatus(alice.ctx, { memberId: danId, status: "suspended" })).ok).toBe(true);
    expect((await dan.client.from("households").select("id").eq("id", household)).data).toEqual([]);
    expect((await setHouseholdMemberStatus(alice.ctx, { memberId: danId, status: "active" })).ok).toBe(true);
    expect((await dan.client.from("households").select("id").eq("id", household)).data).toHaveLength(1);
  });
});

describe("6 · invitation tokens", () => {
  let household: string;

  beforeAll(async () => {
    household = await newHousehold(alice, "Invitation test");
  });

  it("can be used exactly once", async () => {
    const erin = await createTestUser("erin");
    const invite = unwrap(
      await inviteHouseholdMember(alice.ctx, { householdId: household, email: erin.email, role: "member" }),
    );
    expect((await acceptHouseholdInvitation(erin.ctx, { token: invite.token })).ok).toBe(true);
    const again = await acceptHouseholdInvitation(erin.ctx, { token: invite.token });
    expect(again.ok || again.error.reason).toBe("invitation_used");
  });

  it("are bound to the invited email address", async () => {
    const invited = await createTestUser("invited");
    const intruder = await createTestUser("intruder");
    const invite = unwrap(
      await inviteHouseholdMember(alice.ctx, { householdId: household, email: invited.email, role: "guest" }),
    );
    const stolen = await acceptHouseholdInvitation(intruder.ctx, { token: invite.token });
    expect(stolen.ok || stolen.error.reason).toBe("invitation_email_mismatch");
    expect((await acceptHouseholdInvitation(invited.ctx, { token: invite.token })).ok).toBe(true);
  });

  it("cannot be used after revocation or expiry", async () => {
    const frank = await createTestUser("frank");
    const revoked = unwrap(
      await inviteHouseholdMember(alice.ctx, { householdId: household, email: frank.email, role: "guest" }),
    );
    expect((await revokeHouseholdInvitation(alice.ctx, { invitationId: revoked.invitationId })).ok).toBe(true);
    const afterRevoke = await acceptHouseholdInvitation(frank.ctx, { token: revoked.token });
    expect(afterRevoke.ok || afterRevoke.error.reason).toBe("invitation_expired");

    const expiring = unwrap(
      await inviteHouseholdMember(alice.ctx, { householdId: household, email: frank.email, role: "guest" }),
    );
    await adminClient()
      .from("household_invitations")
      .update({
        expires_at: new Date(Date.now() - 1000).toISOString(),
        created_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .eq("id", expiring.invitationId);
    const afterExpiry = await acceptHouseholdInvitation(frank.ctx, { token: expiring.token });
    expect(afterExpiry.ok || afterExpiry.error.reason).toBe("invitation_expired");
    const preview = unwrap(await getHouseholdInvitation(frank.ctx, { token: expiring.token }));
    expect(preview.status).toBe("expired");
  });

  it("rejects duplicates while one is pending, and unknown or malformed tokens", async () => {
    const email = "dup@bahayplus.test";
    unwrap(await inviteHouseholdMember(alice.ctx, { householdId: household, email, role: "guest" }));
    const duplicate = await inviteHouseholdMember(alice.ctx, {
      householdId: household,
      email: email.toUpperCase(),
      role: "member",
    });
    expect(duplicate.ok || duplicate.error.reason).toBe("duplicate_invitation");
    const random = await acceptHouseholdInvitation(alice.ctx, { token: "A".repeat(43) });
    expect(random.ok || random.error.reason).toBe("invitation_invalid");
    const malformed = await acceptHouseholdInvitation(alice.ctx, { token: "not a token" });
    expect(malformed.ok || malformed.error.reason).toBe("invitation_invalid");
  });

  it("requires a verified email and never exposes token hashes", async () => {
    const unverified = await createTestUser("unverified", { confirmed: false });
    const invite = unwrap(
      await inviteHouseholdMember(alice.ctx, { householdId: household, email: unverified.email, role: "guest" }),
    );
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const leak = await alice.client
      .from("household_invitations")
      .select("token_hash" as "id")
      .eq("household_id", household);
    expect(leak.error?.code).toBe("42501");
    const listed = unwrap(await listHouseholdInvitations(alice.ctx, household));
    expect(listed.length).toBeGreaterThan(0);
    expect(JSON.stringify(listed)).not.toContain(invite.token);
  });

  it("organization invitations follow the same single-use rule", async () => {
    const org = unwrap(
      await createOrganization(alice.ctx, {
        kind: "service_provider",
        name: "Invite Co",
        slug: `invite-${Date.now()}`,
      }),
    ).organizationId;
    const gina = await createTestUser("gina");
    const invite = unwrap(
      await inviteOrganizationMember(alice.ctx, { organizationId: org, email: gina.email, role: "worker" }),
    );
    expect((await acceptOrganizationInvitation(gina.ctx, { token: invite.token })).ok).toBe(true);
    const again = await acceptOrganizationInvitation(gina.ctx, { token: invite.token });
    expect(again.ok || again.error.reason).toBe("invitation_used");
  });
});

describe("7 · multiple memberships and context switching", () => {
  it("resolves a different role and permission set per context without leakage", async () => {
    const hana = await createTestUser("hana");
    const own = await newHousehold(hana, "Hana's home");
    const parents = await newHousehold(alice, "Parents' home");
    await addMember(alice, parents, hana, "guest");
    const org = unwrap(
      await createOrganization(alice.ctx, { kind: "service_provider", name: "Multi Co", slug: `multi-${Date.now()}` }),
    ).organizationId;
    const invite = unwrap(
      await inviteOrganizationMember(alice.ctx, { organizationId: org, email: hana.email, role: "worker" }),
    );
    unwrap(await acceptOrganizationInvitation(hana.ctx, { token: invite.token }));

    const ownAccess = unwrap(await loadHouseholdAccess(hana.ctx, own));
    const parentsAccess = unwrap(await loadHouseholdAccess(hana.ctx, parents));
    const orgAccess = unwrap(await loadOrganizationAccess(hana.ctx, org));
    expect(ownAccess.role).toBe("owner");
    expect(ownAccess.permissions.has("property.manage")).toBe(true);
    expect(parentsAccess.role).toBe("guest");
    expect(parentsAccess.permissions.has("property.view")).toBe(false);
    expect(orgAccess.role).toBe("worker");
    expect(orgAccess.permissions.has("organization.members.view")).toBe(false);

    // Guest rights in one household don't inherit owner rights from another.
    expect((await updateHousehold(hana.ctx, { householdId: own, name: "Renamed" })).ok).toBe(true);
    expect((await updateHousehold(hana.ctx, { householdId: parents, name: "Renamed" })).ok).toBe(false);
    expect((await hana.client.from("properties").select("id").eq("household_id", parents)).data).toEqual([]);
    expect((await hana.client.from("household_members").select("id").eq("household_id", parents)).data).toHaveLength(1); // only her own row

    const contexts = unwrap(await listMyContexts(hana.ctx));
    expect(contexts.map((c) => `${c.kind}:${c.roleKey}`).sort()).toEqual([
      "household:guest",
      "household:owner",
      "organization:worker",
    ]);
  });
});

describe("audit trail", () => {
  it("records membership changes and cannot be read by regular users or rewritten by anyone", async () => {
    const admin = adminClient();
    const { data } = await admin.from("audit_logs").select("action").eq("household_id", householdA);
    expect(data?.map((d) => d.action)).toEqual(expect.arrayContaining(["household.created", "household.member_added"]));
    expect((await alice.client.from("audit_logs").select("id").limit(1)).data).toEqual([]);
    const tamper = await admin.from("audit_logs").update({ action: "x.y" }).eq("household_id", householdA);
    expect(tamper.error).not.toBeNull();
    const wipe = await admin.from("audit_logs").delete().eq("household_id", householdA);
    expect(wipe.error).not.toBeNull();
  });

  it("platform admins (granted server-side, verified with MFA) can read the audit log", async () => {
    const ivy = await createTestUser("ivy");
    const admin = adminClient();
    const ops = await admin.from("roles").select("id").eq("scope", "platform").eq("key", "operations").single();
    expect((await admin.from("platform_admins").insert({ user_id: ivy.id, role_id: ops.data!.id })).error).toBeNull();
    await verifySecondFactor(ivy);
    const { data } = await ivy.client.from("audit_logs").select("action").eq("target_id", ivy.id);
    expect(data?.map((d) => d.action)).toContain("platform.admin_granted");
  });
});
