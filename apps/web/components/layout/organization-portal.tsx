import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { RegisterBusinessForm } from "@/components/onboarding/register-business-form";
import { getMyContexts, requireOrganizationAccess } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/session";
import { roleLabel } from "@/lib/config/roles";
import { LAST_CONTEXT_COOKIE } from "@/lib/config/routes";
import { ContextSwitcher } from "./context-switcher";
import { PortalShell } from "./portal-shell";

type OrgPortal = "provider" | "supplier";
const KIND = { provider: "service_provider", supplier: "supplier" } as const;

/** Business portal entry: open the last-used organization of this kind, or onboard a new one. */
export async function OrganizationPortalEntry({ portal, creating }: { portal: OrgPortal; creating: boolean }) {
  const user = await requireUser(`/${portal}`);
  const orgs = (await getMyContexts()).filter(
    (c) => c.kind === "organization" && c.orgKind === KIND[portal] && c.roleKey !== "worker",
  );
  if (orgs.length > 0 && !creating) {
    const last = (await cookies()).get(LAST_CONTEXT_COOKIE[portal])?.value;
    redirect(`/${portal}/o/${(orgs.find((o) => o.id === last) ?? orgs[0]!).id}`);
  }
  return (
    <OnboardingCard
      user={user}
      title={portal === "provider" ? "Register your service business" : "Register as a supplier"}
      description={
        portal === "provider"
          ? "Offer home, pet, vehicle or renovation services to Bahay+ households. Verification comes next."
          : "Sell materials and supplies to service providers on Bahay+."
      }
    >
      <RegisterBusinessForm kind={KIND[portal]} />
    </OnboardingCard>
  );
}

export async function OrganizationPortalShell({
  portal,
  organizationId,
  children,
}: {
  portal: OrgPortal;
  organizationId: string;
  children: ReactNode;
}) {
  const access = await requireOrganizationAccess(organizationId, KIND[portal]);
  // Field workers use /worker; the business portal is for owners, managers and staff.
  if (access.role === "worker") redirect("/worker");
  const orgs = (await getMyContexts()).filter(
    (c) => c.kind === "organization" && c.orgKind === KIND[portal] && c.roleKey !== "worker" && c.id,
  );
  return (
    <PortalShell
      portal={portal}
      basePath={`/${portal}/o/${organizationId}`}
      context={
        <ContextSwitcher
          kind={KIND[portal]}
          current={{
            id: organizationId,
            name: access.organizationName,
            roleLabel: roleLabel("organization", access.role),
          }}
          options={orgs.map((o) => ({
            id: o.id!,
            name: o.name,
            roleLabel: roleLabel("organization", o.roleKey),
            href: `/${portal}/o/${o.id}`,
          }))}
          create={{ href: `/${portal}?new=1`, label: "Register another business" }}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
