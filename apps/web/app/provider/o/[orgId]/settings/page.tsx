import Link from "next/link";
import { getCapacity, getProviderProfile } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { AvailabilityToggle } from "@/components/marketplace/provider-forms";
import { providerContext } from "@/components/marketplace/provider-guard";
import { CapacityForm } from "@/components/organizations/capacity-form";

export const metadata = { title: "Settings" };

export default async function ProviderSettingsPage({ params }: PageProps<"/provider/o/[orgId]/settings">) {
  const { orgId } = await params;
  const { access, ctx, canManage, base } = await providerContext(orgId);
  const [profile, capacity] = await Promise.all([getProviderProfile(ctx, orgId), getCapacity(ctx, orgId)]);
  return (
    <>
      <PageHeader
        title="Settings"
        description={access.organizationName}
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Settings" }]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Availability" id="availability">
          {profile.ok && (
            <>
              <AvailabilityToggle organizationId={orgId} status={profile.value.availabilityStatus} />
              <p className="text-xs text-muted-foreground">
                {profile.value.availabilityUpdatedAt
                  ? `Last updated ${formatManilaDateTime(profile.value.availabilityUpdatedAt)}. Customers see when you last updated it; after a day it's flagged as possibly out of date.`
                  : "Never updated. Customers see that your availability is unknown."}
              </p>
            </>
          )}
          {canManage ? (
            <CapacityForm organizationId={orgId} capacity={capacity} />
          ) : (
            <p className="text-sm">Capacity: {capacity} job(s) at a time</p>
          )}
          <p className="text-xs text-muted-foreground">
            Book Now is refused when this many confirmed jobs already overlap the requested time.
          </p>
        </SectionCard>
        <SectionCard title="Business" id="business">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href={`${base}/profile`} className="font-medium text-brand hover:underline">
                Business profile & contact details
              </Link>
            </li>
            <li>
              <Link href={`${base}/staff`} className="font-medium text-brand hover:underline">
                Staff & roles
              </Link>
            </li>
            <li>
              <Link href={`${base}/verification`} className="font-medium text-brand hover:underline">
                Verification
              </Link>
            </li>
            <li>
              <Link href="/account/notifications/settings" className="font-medium text-brand hover:underline">
                Your notification settings
              </Link>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">Your role: {access.role}</p>
        </SectionCard>
      </div>
    </>
  );
}
