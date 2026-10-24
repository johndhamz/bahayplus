import { CalendarDays, House, Receipt } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ServiceCard } from "@bahayplus/ui/components/domain/service-card";
import { UrgentHelpCard } from "@/components/domain/urgent-help-card";
import { Button } from "@bahayplus/ui/components/ui/button";
import { requireHouseholdAccess } from "@/lib/auth/context";
import { QUICK_CATEGORIES, SERVICE_DIVISIONS } from "@/lib/config/service-catalog";

export const metadata = { title: "Home" };

export default async function HouseholdHomePage({ params }: PageProps<"/app/h/[householdId]">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  const base = `/app/h/${householdId}`;
  const quick = QUICK_CATEGORIES.slice(0, 8);
  return (
    <>
      <PageHeader
        eyebrow={access.householdName}
        title="Mabuhay! Welcome home"
        description="Everything about your home, in one place."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Your household" id="household" className="lg:col-span-2">
          <EmptyState
            size="compact"
            icon={House}
            title="Add your first property"
            description="Add your house, condo or apartment to start tracking bills, assets and services."
            action={
              <Button asChild>
                <Link href={`${base}/properties`}>Add property</Link>
              </Button>
            }
          />
        </SectionCard>

        <UrgentHelpCard href={`${base}/services?urgent=1`} />

        <SectionCard
          title="Quick services"
          id="quick-services"
          action={{ href: `${base}/services`, label: "All services" }}
          className="lg:col-span-3"
        >
          <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
            {quick.map((c) => (
              <li key={c.slug}>
                <ServiceCard variant="tile" name={c.label} icon={c.icon} href={`${base}/services?category=${c.slug}`} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Upcoming" id="upcoming" action={{ href: `${base}/calendar`, label: "Calendar" }}>
          <EmptyState
            size="compact"
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Bookings, reminders and due dates will appear here."
          />
        </SectionCard>

        <SectionCard title="Bills" id="bills" action={{ href: `${base}/bills`, label: "All bills" }}>
          <EmptyState
            size="compact"
            icon={Receipt}
            title="No bills tracked yet"
            description="Add your electricity, water and internet accounts to see what's due."
          />
        </SectionCard>

        <SectionCard title="Find a service" id="discover">
          <ul className="flex flex-col gap-2">
            {SERVICE_DIVISIONS.map((d) => (
              <li key={d.id}>
                <Link
                  href={`${base}/services?division=${d.id}`}
                  className="flex min-h-12 flex-col justify-center rounded-xl border border-border px-3 py-2 hover:border-brand/40 hover:bg-sage/40"
                >
                  <span className="text-sm font-semibold">{d.label}</span>
                  <span className="text-xs text-muted-foreground">{d.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
