import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_ROLES,
  ORGANIZATION_ROLES,
  PLATFORM_ROLES,
  ROLE_PERMISSIONS,
} from "@bahayplus/modules/authorization";
import { adminClient } from "../support/supabase";

describe("role/permission reference data", () => {
  it("the TypeScript mirror matches the database exactly", async () => {
    const { data, error } = await adminClient()
      .from("roles")
      .select("scope, key, rank, role_permissions(permissions(key))");
    expect(error).toBeNull();
    const fromDb: Record<string, Record<string, { rank: number; permissions: string[] }>> = {};
    for (const role of data ?? []) {
      (fromDb[role.scope] ??= {})[role.key] = {
        rank: role.rank,
        permissions: role.role_permissions.map((rp) => rp.permissions!.key).sort(),
      };
    }
    const mirror = (
      scope: "household" | "organization" | "platform",
      roles: readonly { key: string; rank: number }[],
    ) =>
      Object.fromEntries(
        roles.map((r) => [
          r.key,
          {
            rank: r.rank,
            permissions: [...(ROLE_PERMISSIONS[scope] as Record<string, readonly string[]>)[r.key]!].sort(),
          },
        ]),
      );
    expect(fromDb.household).toEqual(mirror("household", HOUSEHOLD_ROLES));
    expect(fromDb.organization).toEqual(mirror("organization", ORGANIZATION_ROLES));
    expect(fromDb.platform).toEqual(mirror("platform", PLATFORM_ROLES));
  });
});
