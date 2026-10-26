import { CalendarDays, Package, Receipt, Wallet } from "lucide-react";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { LoadingSkeleton } from "@bahayplus/ui/components/feedback/loading-skeleton";
import { SampleDataBadge, SampleDataNotice } from "@bahayplus/ui/components/feedback/sample-data";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ComponentGallery } from "./component-gallery";

const SWATCHES = [
  { name: "Primary", value: "#153D35", className: "bg-brand text-brand-foreground" },
  { name: "Background", value: "#F6F3EB", className: "bg-background text-foreground border border-border" },
  { name: "Accent", value: "#E5C584", className: "bg-gold text-gold-foreground" },
  { name: "Terracotta", value: "#C57A59", className: "bg-terracotta text-terracotta-foreground" },
  { name: "Sage", value: "#E0E9E2", className: "bg-sage text-sage-foreground" },
  { name: "Surface", value: "#FFFFFF", className: "bg-surface text-foreground border border-border" },
];

export default function DesignSystemPreviewPage() {
  return (
    <main id="main-content" className="flex flex-col gap-8">
      <PageHeader
        title="Bahay+ design system"
        description="Tokens and shared components. Values on this page are illustrative."
        breadcrumbs={[{ label: "Preview", href: "/preview" }, { label: "Components" }]}
      />
      <SampleDataNotice />

      <section aria-labelledby="colors">
        <h2 id="colors" className="mb-3 font-heading text-lg font-semibold">
          Colour
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SWATCHES.map((s) => (
            <li key={s.name} className={`flex h-24 flex-col justify-end rounded-2xl p-3 ${s.className}`}>
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="font-mono text-xs">{s.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-2">
        <h2 id="type" className="font-heading text-lg font-semibold">
          Typography
        </h2>
        <p className="font-heading text-4xl font-extrabold text-brand">Plus Jakarta Sans — headings</p>
        <p className="text-base">Inter — body text. Mabuhay! Everything home, one app.</p>
      </section>

      <section aria-labelledby="stats">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="stats" className="font-heading text-lg font-semibold">
            Stat cards
          </h2>
          <SampleDataBadge />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Bills due" value="₱5,435.50" icon={Receipt} hint="2 this week" tone="brand" />
          <StatCard
            label="Upcoming"
            value="3"
            icon={CalendarDays}
            trend={{ direction: "up", label: "+1", sentiment: "neutral" }}
          />
          <StatCard
            label="Spent this month"
            value="₱18,240.00"
            icon={Wallet}
            trend={{ direction: "down", label: "8%", sentiment: "positive" }}
          />
          <StatCard label="Assets" value="12" icon={Package} tone="terracotta" />
        </div>
      </section>

      <section aria-labelledby="badges" className="flex flex-col gap-3">
        <h2 id="badges" className="font-heading text-lg font-semibold">
          Status badges
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            "paid",
            "partially_paid",
            "unpaid",
            "overdue",
            "submitted",
            "under_review",
            "approved",
            "rejected",
            "draft",
            "something_new",
          ].map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </section>

      <section aria-labelledby="states" className="grid gap-4 lg:grid-cols-2">
        <h2 id="states" className="font-heading text-lg font-semibold lg:col-span-2">
          Empty & loading states
        </h2>
        <EmptyState title="No pets yet" description="Add your first pet to track vaccinations and vet visits." />
        <LoadingSkeleton variant="list" />
      </section>

      <ComponentGallery />
    </main>
  );
}
