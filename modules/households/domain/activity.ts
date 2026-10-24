import { HOUSEHOLD_ROLES } from "@bahayplus/modules/authorization";

export type ActivityKind =
  | "property.created"
  | "property.updated"
  | "property.archived"
  | "property.restored"
  | "household.renamed"
  | "household.default_property_set"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "member.suspended"
  | "member.reactivated"
  | "invitation.sent"
  | "invitation.revoked";

type Meta = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (typeof v === "string" && v ? v : fallback);
const roleName = (key: unknown) => HOUSEHOLD_ROLES.find((r) => r.key === key)?.name ?? str(key, "member");

/** Human sentence for an activity row. Unknown kinds degrade gracefully instead of failing. */
export function describeActivity(kind: string, meta: Meta): string {
  switch (kind) {
    case "property.created":
      return `Added property “${str(meta.name, "Untitled")}”`;
    case "property.updated":
      return `Updated property “${str(meta.name, "Untitled")}”`;
    case "property.archived":
      return `Archived property “${str(meta.name, "Untitled")}”`;
    case "property.restored":
      return `Restored property “${str(meta.name, "Untitled")}”`;
    case "household.renamed":
      return `Renamed the household to “${str(meta.to)}”`;
    case "household.default_property_set":
      return `Set “${str(meta.name, "a property")}” as the default property`;
    case "member.joined":
      return `${str(meta.member, "Someone")} joined as ${roleName(meta.role)}`;
    case "member.removed":
      return `${str(meta.member, "A member")} left or was removed`;
    case "member.role_changed":
      return `${str(meta.member, "A member")} is now ${roleName(meta.role)}`;
    case "member.suspended":
      return `${str(meta.member, "A member")} was suspended`;
    case "member.reactivated":
      return `${str(meta.member, "A member")} was reactivated`;
    case "invitation.sent":
      return `Invited ${str(meta.email, "someone")} as ${roleName(meta.role)}`;
    case "invitation.revoked":
      return `Cancelled the invitation for ${str(meta.email, "someone")}`;
    default:
      return "Household updated";
  }
}
