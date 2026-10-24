import { BellRing, Building2, Car, MailPlus, Package, PawPrint, Plus, Receipt, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { getHouseholdOverview, listHouseholdActivity, listHouseholdMembers } from "@bahayplus/modules/households";
import { listProperties } from "@bahayplus/modules/properties";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { ServiceCard } from "@bahayplus/ui/components/domain/service-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { UrgentHelpCard } from "@/components/domain/urgent-help-card";
import { ActivityList } from "@/components/households/activity-list";
import { PropertyCard } from "@/components/households/property-card";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";
import { roleLabel } from "@/lib/config/roles";
import { QUICK_CATEGORIES } from "@/lib/config/service-catalog";

export const metadata = { title: "Home" };

const SHORTCUTS = [
  { path: "assets", label: "Assets", icon: Package },
  { path: "bills", label: "Bills", icon: Receipt },
  { path: "pets", label: "Pets", icon: PawPrint },
  { path: "vehicles", label: "Vehicles", icon: Car },
  { path: "services", label: "Services", icon: Wrench },
] as const;

export default async function HouseholdHomePage({ params }: PageProps<"/app/h/[householdId]">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const can = (p: Parameters<typeof access.permissions.has>[0]) => access.permissions.has(p);

  const [overview, properties, members, activity] = await Promise.all([
    getHouseholdOverview(ctx, access),
    can("property.view") ? listProperties(ctx, householdId) : null,
    can("household.members.view") ? listHouseholdMembers(ctx, householdId) : null,
    listHouseholdActivity(ctx, householdId, { limit: 6 }),
  ]);

  if (!overview.ok) return <ErrorState description="We couldn't load your household overview." />;
  const o = overview.value;
  const activeMembers = members?.ok ? members.value.filter((m) => m.status === "active") : [];

  return (
    <>
      <PageHeader
        eyebrow={`${access.householdName} · ${roleLabel("household", access.role)}`}
        title="Mabuhay! Welcome home"
        description="Everything about your home, in one place."
      />

      <section aria-label="Household overview" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {o.activeProperties !== null && (
          <StatCard
            label="Properties"
            value={o.activeProperties}
            icon={Building2}
            tone="brand"
            href={`${base}/properties`}
            hint={o.archivedProperties ? `${o.archivedProperties} archived` : undefined}
          />
        )}
        {o.activeMembers !== null && (
          <StatCard label="Members" value={o.activeMembers} icon={Users} href={`${base}/members`} />
        )}
        {o.pendingInvitations !== null && (
          <StatCard label="Pending invites" value={o.pendingInvitations} icon={MailPlus} href={`${base}/members`} />
        )}
        <StatCard
          label="Reminders"
          value="—"
          icon={BellRing}
          hint="Available when assets, pets, vehicles and bills are added"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {properties && (
          <SectionCard
            title="Properties"
            id="properties"
            className="lg:col-span-2"
            action={{ href: `${base}/properties`, label: "All properties" }}
          >
            {!properties.ok ? (
              <ErrorState description="We couldn't load properties." />
            ) : properties.value.length === 0 ? (
              <EmptyState
                size="compact"
                icon={Building2}
                title="No properties yet"
                description="Add your house, condo or apartment to organise bills, assets and services by location."
                action={
                  can("property.manage") ? (
                    <Button asChild>
                      <Link href={`${base}/properties/new`}>
                        <Plus aria-hidden="true" /> Add property
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {properties.value.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <PropertyCard property={p} href={`${base}/properties/${p.id}`} className="h-full" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <UrgentHelpCard href={`${base}/services?urgent=1`} className={properties ? "" : "lg:col-span-3"} />

        {members && members.ok && (
          <SectionCard title="Members" id="members" action={{ href: `${base}/members`, label: "Manage" }}>
            <ul className="flex flex-col gap-2">
              {activeMembers.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 place-items-center rounded-full bg-brand text-sm font-semibold text-gold"
                  >
                    {m.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.fullName}</span>
                  <span className="text-xs text-muted-foreground">{roleLabel("household", m.role)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard title="Upcoming reminders" id="reminders">
          <EmptyState
            size="compact"
            icon={BellRing}
            title="No reminders yet"
            description="Warranty, vaccination, registration and bill reminders will appear here as you add them."
          />
        </SectionCard>

        <SectionCard title="Recent activity" id="activity">
          {activity.ok ? (
            <ActivityList items={activity.value} />
          ) : (
            <ErrorState description="We couldn't load activity." />
          )}
        </SectionCard>

        <SectionCard title="Shortcuts" id="shortcuts" className="lg:col-span-3">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SHORTCUTS.map((s) => (
              <li key={s.path}>
                <ServiceCard variant="tile" name={s.label} icon={s.icon} href={`${base}/${s.path}`} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Quick services"
          id="quick-services"
          className="lg:col-span-3"
          action={{ href: `${base}/services`, label: "All services" }}
        >
          <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
            {QUICK_CATEGORIES.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <ServiceCard variant="tile" name={c.label} icon={c.icon} href={`${base}/services?category=${c.slug}`} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
