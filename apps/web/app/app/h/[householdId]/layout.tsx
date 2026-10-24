import { ContextSwitcher } from "@/components/layout/context-switcher";
import { PortalShell } from "@/components/layout/portal-shell";
import { getMyContexts, requireHouseholdAccess } from "@/lib/auth/context";
import { roleLabel } from "@/lib/config/roles";

export default async function HouseholdLayout({ children, params }: LayoutProps<"/app/h/[householdId]">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  const households = (await getMyContexts()).filter((c) => c.kind === "household" && c.id);
  return (
    <PortalShell
      portal="app"
      basePath={`/app/h/${householdId}`}
      context={
        <ContextSwitcher
          kind="household"
          current={{ id: householdId, name: access.householdName, roleLabel: roleLabel("household", access.role) }}
          options={households.map((h) => ({
            id: h.id!,
            name: h.name,
            roleLabel: roleLabel("household", h.roleKey),
            href: `/app/h/${h.id}`,
          }))}
          create={{ href: "/app?new=1", label: "Create household" }}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
