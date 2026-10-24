import { Boxes, Store } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";

export const metadata = { title: "Supplier dashboard" };

export default function SupplierDashboardPage() {
  return (
    <>
      <PageHeader title="Supplier dashboard" description="Products, inventory, purchase orders and deliveries." />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Your supplier business" id="business" className="xl:col-span-2">
          <EmptyState
            icon={Store}
            title="No supplier business linked to your account"
            description="Register as a supplier or ask an owner to invite you."
          />
        </SectionCard>
        <SectionCard title="Inventory alerts" id="alerts">
          <EmptyState size="compact" icon={Boxes} title="No alerts" />
        </SectionCard>
      </div>
    </>
  );
}
