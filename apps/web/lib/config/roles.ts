import { HOUSEHOLD_ROLES, ORGANIZATION_ROLES, PLATFORM_ROLES } from "@bahayplus/modules/authorization";

const LABELS: Record<string, Record<string, string>> = {
  household: Object.fromEntries(HOUSEHOLD_ROLES.map((r) => [r.key, r.name])),
  organization: Object.fromEntries(ORGANIZATION_ROLES.map((r) => [r.key, r.name])),
  platform: Object.fromEntries(PLATFORM_ROLES.map((r) => [r.key, r.name])),
};

export function roleLabel(scope: "household" | "organization" | "platform", key: string): string {
  return LABELS[scope]?.[key] ?? key;
}
