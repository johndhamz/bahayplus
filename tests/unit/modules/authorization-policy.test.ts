import { describe, expect, it } from "vitest";
import {
  assignableRanks,
  evaluateMembershipChange,
  HOUSEHOLD_ROLES,
  ORGANIZATION_ROLES,
  roleRank,
  wouldRemoveLastOwner,
} from "@bahayplus/modules/authorization";
import { mapDbError } from "@bahayplus/modules/authorization";

const OWNER = { actorRank: 100, actorCanManageMembers: true, actorCanManageOwners: true };
const MANAGER = { actorRank: 80, actorCanManageMembers: true, actorCanManageOwners: false };
const MEMBER = { actorRank: 50, actorCanManageMembers: false, actorCanManageOwners: false };

describe("membership change policy (mirrors SQL)", () => {
  it("owners may do anything, including granting owner", () => {
    expect(evaluateMembershipChange({ ...OWNER, isSelf: false, targetRank: 50, newRank: 100 })).toEqual({
      allowed: true,
    });
    expect(evaluateMembershipChange({ ...OWNER, isSelf: false, targetRank: 100, newRank: 80 })).toEqual({
      allowed: true,
    });
  });

  it("managers may manage only strictly lower roles and assign only lower roles", () => {
    expect(evaluateMembershipChange({ ...MANAGER, isSelf: false, targetRank: 50, newRank: 30 }).allowed).toBe(true);
    expect(evaluateMembershipChange({ ...MANAGER, isSelf: false, targetRank: 50, newRank: 80 })).toEqual({
      allowed: false,
      reason: "role_escalation",
    });
    expect(evaluateMembershipChange({ ...MANAGER, isSelf: false, targetRank: 80, newRank: 50 })).toEqual({
      allowed: false,
      reason: "forbidden",
    });
    expect(evaluateMembershipChange({ ...MANAGER, isSelf: false, targetRank: 100 })).toEqual({
      allowed: false,
      reason: "role_escalation",
    });
  });

  it("nobody may raise their own role", () => {
    expect(evaluateMembershipChange({ ...MANAGER, isSelf: true, targetRank: 80, newRank: 100 }).allowed).toBe(false);
    expect(
      evaluateMembershipChange({ ...OWNER, actorRank: 100, isSelf: true, targetRank: 100, newRank: 80 }).allowed,
    ).toBe(true);
  });

  it("members without manage permission are refused", () => {
    expect(evaluateMembershipChange({ ...MEMBER, isSelf: false, targetRank: 10, newRank: 10 })).toEqual({
      allowed: false,
      reason: "forbidden",
    });
  });

  it("lists assignable roles per actor", () => {
    const ranks = HOUSEHOLD_ROLES.map((r) => r.rank);
    expect(assignableRanks(100, true, ranks)).toEqual([100, 80, 50, 30, 10]);
    expect(assignableRanks(80, false, ranks)).toEqual([50, 30, 10]);
    expect(assignableRanks(50, false, ranks)).toEqual([30, 10]);
  });

  it("detects last-owner removal", () => {
    expect(wouldRemoveLastOwner({ targetIsOwner: true, activeOwnerCount: 1, keepsOwnerRole: false })).toBe(true);
    expect(wouldRemoveLastOwner({ targetIsOwner: true, activeOwnerCount: 2, keepsOwnerRole: false })).toBe(false);
    expect(wouldRemoveLastOwner({ targetIsOwner: true, activeOwnerCount: 1, keepsOwnerRole: true })).toBe(false);
  });

  it("knows role ranks", () => {
    expect(roleRank("household", "limited")).toBe(30);
    expect(roleRank("organization", "worker")).toBe(30);
    expect(ORGANIZATION_ROLES.map((r) => r.key)).toEqual(["owner", "manager", "staff", "worker"]);
  });
});

describe("database error mapping", () => {
  it("maps business errors raised by SQL functions", () => {
    expect(mapDbError({ code: "P0001", message: "last_owner", details: "Keep one owner." })).toEqual({
      code: "CONFLICT",
      message: "Keep one owner.",
      reason: "last_owner",
    });
    expect(mapDbError({ code: "P0001", message: "role_escalation", details: "No." })).toMatchObject({
      code: "FORBIDDEN",
      reason: "role_escalation",
    });
    expect(mapDbError({ code: "P0001", message: "not_found", details: "Gone." })).toMatchObject({ code: "NOT_FOUND" });
    expect(mapDbError({ code: "P0001", message: "invalid_role" })).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(mapDbError({ code: "P0001", message: "unauthenticated" })).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("maps Postgres/PostgREST errors without leaking internals", () => {
    expect(mapDbError({ code: "42501", message: "new row violates row-level security policy" })).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mapDbError({ code: "23505", message: "duplicate key value violates unique constraint" })).toMatchObject({
      code: "CONFLICT",
    });
    const unknown = mapDbError({ code: "XX000", message: "internal detail: secret table name" });
    expect(unknown.code).toBe("INTERNAL");
    expect(unknown.message).not.toContain("secret");
  });
});
