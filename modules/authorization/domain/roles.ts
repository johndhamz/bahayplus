import type { HouseholdRoleKey, OrganizationRoleKey, PlatformRoleKey } from "@bahayplus/validation/common/primitives";

/**
 * Mirror of the role/permission reference data seeded in
 * supabase/migrations/20261025000100_authorization_foundation.sql.
 * The database is the source of truth at runtime; an integration test asserts this mirror matches it.
 */
export type RoleScope = "household" | "organization" | "platform";

export type RoleDefinition<K extends string> = { key: K; name: string; rank: number; description: string };

export const HOUSEHOLD_ROLES: readonly RoleDefinition<HouseholdRoleKey>[] = [
  { key: "owner", name: "Owner", rank: 100, description: "Full control, including owners and deletion." },
  { key: "manager", name: "Manager", rank: 80, description: "Manages members, invitations and properties." },
  { key: "member", name: "Member", rank: 50, description: "Sees the household and its properties." },
  { key: "limited", name: "Limited member", rank: 30, description: "Tenant, kasambahay, driver or caregiver." },
  { key: "guest", name: "Guest", rank: 10, description: "Temporary read-only access to basics." },
];

export const ORGANIZATION_ROLES: readonly RoleDefinition<OrganizationRoleKey>[] = [
  { key: "owner", name: "Owner", rank: 100, description: "Full control, including owners and deletion." },
  { key: "manager", name: "Manager", rank: 80, description: "Runs operations and manages staff." },
  { key: "staff", name: "Staff", rank: 50, description: "Day-to-day operations." },
  { key: "worker", name: "Worker", rank: 30, description: "Field worker. Sees only assigned work." },
];

export const PLATFORM_ROLES: readonly RoleDefinition<PlatformRoleKey>[] = [
  { key: "super_admin", name: "Super admin", rank: 100, description: "Full platform administration." },
  { key: "operations", name: "Operations", rank: 80, description: "Verification, catalogs, organizations." },
  { key: "support", name: "Support", rank: 50, description: "Read-mostly support access." },
];

export const HOUSEHOLD_PERMISSIONS = [
  "household.view",
  "household.update",
  "household.delete",
  "household.members.view",
  "household.members.manage",
  "household.owners.manage",
  "household.invitations.manage",
  "property.view",
  "property.manage",
  "registry.view",
  "registry.manage",
  "pet.health.view",
  "pet.health.manage",
  "bills.view",
  "bills.manage",
  "budget.view",
  "budget.manage",
] as const;
export type HouseholdPermission = (typeof HOUSEHOLD_PERMISSIONS)[number];

export const ORGANIZATION_PERMISSIONS = [
  "organization.view",
  "organization.update",
  "organization.delete",
  "organization.members.view",
  "organization.members.manage",
  "organization.owners.manage",
  "organization.invitations.manage",
] as const;
export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];

export const PLATFORM_PERMISSIONS = [
  "platform.access",
  "platform.users.view",
  "platform.organizations.manage",
  "platform.verifications.decide",
  "platform.audit.view",
  "platform.settings.manage",
  "platform.admins.manage",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export type Permission = HouseholdPermission | OrganizationPermission | PlatformPermission;

export const ROLE_PERMISSIONS: {
  household: Record<HouseholdRoleKey, readonly HouseholdPermission[]>;
  organization: Record<OrganizationRoleKey, readonly OrganizationPermission[]>;
  platform: Record<PlatformRoleKey, readonly PlatformPermission[]>;
} = {
  household: {
    owner: HOUSEHOLD_PERMISSIONS,
    manager: [
      "household.view",
      "household.update",
      "household.members.view",
      "household.members.manage",
      "household.invitations.manage",
      "property.view",
      "property.manage",
      "registry.view",
      "registry.manage",
      "pet.health.view",
      "pet.health.manage",
      "bills.view",
      "bills.manage",
      "budget.view",
      "budget.manage",
    ],
    member: [
      "household.view",
      "household.members.view",
      "property.view",
      "registry.view",
      "registry.manage",
      "pet.health.view",
      "pet.health.manage",
      "bills.view",
      "budget.view",
    ],
    limited: ["household.view", "property.view", "registry.view"],
    guest: ["household.view"],
  },
  organization: {
    owner: ORGANIZATION_PERMISSIONS,
    manager: [
      "organization.view",
      "organization.update",
      "organization.members.view",
      "organization.members.manage",
      "organization.invitations.manage",
    ],
    staff: ["organization.view", "organization.members.view"],
    worker: ["organization.view"],
  },
  platform: {
    super_admin: PLATFORM_PERMISSIONS,
    operations: [
      "platform.access",
      "platform.users.view",
      "platform.organizations.manage",
      "platform.verifications.decide",
      "platform.audit.view",
    ],
    support: ["platform.access", "platform.users.view"],
  },
};

export function roleRank(scope: "household", key: HouseholdRoleKey): number;
export function roleRank(scope: "organization", key: OrganizationRoleKey): number;
export function roleRank(scope: RoleScope, key: string): number {
  const list: readonly RoleDefinition<string>[] =
    scope === "household" ? HOUSEHOLD_ROLES : scope === "organization" ? ORGANIZATION_ROLES : PLATFORM_ROLES;
  const role = list.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown ${scope} role: ${key}`);
  return role.rank;
}
