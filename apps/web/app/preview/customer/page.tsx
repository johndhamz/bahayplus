import { Building2, CalendarDays, PawPrint, Receipt, Users } from "lucide-react";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { ProviderCard } from "@bahayplus/ui/components/domain/provider-card";
import { ServiceCard } from "@bahayplus/ui/components/domain/service-card";
import { UrgentHelpCard } from "@/components/domain/urgent-help-card";
import { SampleDataNotice } from "@bahayplus/ui/components/feedback/sample-data";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { QUICK_CATEGORIES } from "@/lib/config/service-catalog";
import { sampleBills, sampleHousehold, sampleProviders, sampleUpcoming } from "@/lib/preview/sample-data";
import { formatManilaDate } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";

export const metadata = { title: "Customer dashboard preview" };

export default function CustomerPreviewPage() {
  return (
    <div className="-mx-4 -my-6 sm:-mx-6">
      <AppShell portal="app" basePath="/preview/customer" layout="mobile-first">
        <SampleDataNotice className="mb-4" />
        <PageHeader
          eyebrow={sampleHousehold.name}
          title="Magandang umaga!"
          description="Here's what's happening at home."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <StatCard label="Properties" value={sampleHousehold.properties} icon={Building2} tone="brand" />
            <StatCard label="Members" value={sampleHousehold.members} icon={Users} />
            <StatCard label="Pets" value={sampleHousehold.pets} icon={PawPrint} />
            <StatCard label="Bills due" value={formatPeso(543_550)} icon={Receipt} tone="terracotta" hint="2 unpaid" />
          </div>
          <UrgentHelpCard href="#" />

          <SectionCard title="Quick services" id="pv-quick" className="lg:col-span-3">
            <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
              {QUICK_CATEGORIES.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <ServiceCard variant="tile" name={c.label} icon={c.icon} href="#" />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Upcoming" id="pv-upcoming">
            <ul className="flex flex-col divide-y divide-border">
              {sampleUpcoming.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-10 place-items-center rounded-xl bg-sage text-brand">
                    <CalendarDays aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.kind} · {u.when}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Bills" id="pv-bills">
            <ul className="flex flex-col divide-y divide-border">
              {sampleBills.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{b.biller}</p>
                    <p className="text-xs text-muted-foreground">Due {formatManilaDate(b.dueOn)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{formatPeso(b.amountCentavos)}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Recommended providers" id="pv-providers">
            <div className="flex flex-col gap-3">
              {sampleProviders.map((p) => (
                <ProviderCard
                  key={p.id}
                  name={p.name}
                  href="#"
                  verification={p.verification}
                  rating={p.rating}
                  categories={p.categories}
                  serviceArea={p.serviceArea}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </AppShell>
    </div>
  );
}
