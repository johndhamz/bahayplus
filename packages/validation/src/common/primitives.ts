import { z } from "zod";

export const Uuid = z.uuid({ message: "Invalid identifier." });

export const Email = z.email({ message: "Enter a valid email address." }).trim().toLowerCase().max(254);

export const HOUSEHOLD_ROLE_KEYS = ["owner", "manager", "member", "limited", "guest"] as const;
export const HouseholdRoleKey = z.enum(HOUSEHOLD_ROLE_KEYS, { message: "Choose a valid household role." });
export type HouseholdRoleKey = z.infer<typeof HouseholdRoleKey>;

export const ORGANIZATION_ROLE_KEYS = ["owner", "manager", "staff", "worker"] as const;
export const OrganizationRoleKey = z.enum(ORGANIZATION_ROLE_KEYS, { message: "Choose a valid team role." });
export type OrganizationRoleKey = z.infer<typeof OrganizationRoleKey>;

export const PLATFORM_ROLE_KEYS = ["super_admin", "operations", "support"] as const;
export type PlatformRoleKey = (typeof PLATFORM_ROLE_KEYS)[number];

export const MembershipStatus = z.enum(["active", "suspended"]);
export type MembershipStatus = z.infer<typeof MembershipStatus>;

/** Opaque invitation token (base64url, 43 chars for 32 random bytes). */
export const InvitationToken = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, "This invitation link is not valid.");
