import { CalendarDays, House, Receipt } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ServiceCard } from "@bahayplus/ui/components/domain/service-card";
import { UrgentHelpCard } from "@/components/domain/urgent-help-card";
import { Button } from "@bahayplus/ui/components/ui/button";
import { QUICK_CATEGORIES, SERVICE_DIVISIONS } from "@/lib/config/service-catalog";

export const metadata = { title: "Home" };

export default function CustomerHomePage() {
  const quick = QUICK_CATEGORIES.slice(0, 8);
  return (
    <>
      <PageHeader eyebrow="Mabuhay!" title="Welcome home" description="Everything about your home, in one place." />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Your household" id="household" className="lg:col-span-2">
          <EmptyState
            size="compact"
            icon={House}
            title="You haven't set up a household yet"
            description="Create your household to add properties, family members, pets, vehicles and bills."
            action={
              <Button asChild>
                <Link href="/app/settings">Set up household</Link>
              </Button>
            }
          />
        </SectionCard>

        <UrgentHelpCard href="/app/services?urgent=1" />

        <SectionCard
          title="Quick services"
          id="quick-services"
          action={{ href: "/app/services", label: "All services" }}
          className="lg:col-span-3"
        >
          <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
            {quick.map((c) => (
              <li key={c.slug}>
                <ServiceCard variant="tile" name={c.label} icon={c.icon} href={`/app/services?category=${c.slug}`} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Upcoming" id="upcoming" action={{ href: "/app/calendar", label: "Calendar" }}>
          <EmptyState
            size="compact"
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Bookings, reminders and due dates will appear here."
          />
        </SectionCard>

        <SectionCard title="Bills" id="bills" action={{ href: "/app/bills", label: "All bills" }}>
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
                  href={`/app/services?division=${d.id}`}
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
