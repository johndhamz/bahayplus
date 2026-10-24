import { CalendarCheck, ClipboardList, FileText, Wallet } from "lucide-react";
import { DataTable, type DataTableColumn } from "@bahayplus/ui/components/data/data-table";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { SampleDataNotice } from "@bahayplus/ui/components/feedback/sample-data";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { sampleActivity, sampleBookings } from "@/lib/preview/sample-data";
import { formatPeso } from "@bahayplus/types/money";
import { BusinessFilters } from "./business-filters";

export const metadata = { title: "Business dashboard preview" };

type Booking = (typeof sampleBookings)[number];

const columns: DataTableColumn<Booking>[] = [
  { key: "id", header: "Booking", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortable: true },
  { key: "customer", header: "Customer", cell: (r) => r.customer },
  { key: "service", header: "Service", cell: (r) => r.service, hideOnMobile: true },
  { key: "city", header: "City", cell: (r) => r.city, hideOnMobile: true },
  { key: "scheduled", header: "Scheduled", cell: (r) => r.scheduled, sortable: true },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "total",
    header: "Total",
    align: "right",
    cell: (r) => <span className="tabular-nums">{formatPeso(r.totalCentavos)}</span>,
  },
];

export default async function BusinessPreviewPage({ searchParams }: PageProps<"/preview/business">) {
  const params = await searchParams;
  const sortKey = typeof params.sort === "string" ? params.sort : "scheduled";
  const direction = params.dir === "desc" ? "desc" : "asc";
  return (
    <div className="-mx-4 -my-6 sm:-mx-6">
      <AppShell portal="provider" basePath="/preview/business" layout="desktop-first">
        <SampleDataNotice className="mb-4" />
        <PageHeader
          title="Provider dashboard"
          description="Desktop-first layout: KPIs, filters, tables and an activity panel."
          breadcrumbs={[{ label: "Provider", href: "/preview/business" }, { label: "Dashboard" }]}
        />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Bookings today" value="6" icon={CalendarCheck} tone="brand" />
          <StatCard label="Open quotations" value="4" icon={FileText} />
          <StatCard label="Work orders in progress" value="3" icon={ClipboardList} />
          <StatCard
            label="Completed (30 days)"
            value={formatPeso(4_825_000)}
            icon={Wallet}
            trend={{ direction: "up", label: "12%", sentiment: "positive" }}
          />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[240px_1fr] 2xl:grid-cols-[240px_1fr_300px]">
          <BusinessFilters />
          <DataTable
            caption="Upcoming bookings (sample)"
            columns={columns}
            rows={sampleBookings}
            getRowKey={(r) => r.id}
            sort={{ key: sortKey, direction }}
            sortHref={(key, dir) => `/preview/business?sort=${key}&dir=${dir}`}
          />
          <SectionCard title="Activity" id="pv-activity" className="xl:col-start-2 2xl:col-start-auto">
            <ol className="flex flex-col gap-3">
              {sampleActivity.map((a) => (
                <li key={a.id} className="border-l-2 border-gold pl-3">
                  <p className="text-sm">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.when}</p>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </AppShell>
    </div>
  );
}
