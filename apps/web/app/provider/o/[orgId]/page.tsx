import { Building2, ClipboardList } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";

export const metadata = { title: "Provider dashboard" };

export default function ProviderDashboardPage() {
  return (
    <>
      <PageHeader
        title="Provider dashboard"
        description="Bookings, quotations, work orders and your team at a glance."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Your business" id="business" className="xl:col-span-2">
          <EmptyState
            icon={Building2}
            title="No provider business linked to your account"
            description="Register your business or ask an owner to invite you. Your KPIs appear once you have bookings."
          />
        </SectionCard>
        <SectionCard title="Recent activity" id="activity">
          <EmptyState size="compact" icon={ClipboardList} title="No activity yet" />
        </SectionCard>
      </div>
    </>
  );
}
