import { Boxes } from "lucide-react";
import { listInventory } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { InventoryTable } from "@/components/supply/inventory-table";
import { StockForm } from "@/components/supply/supplier-forms";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ params }: PageProps<"/supplier/o/[orgId]/inventory">) {
  const { orgId } = await params;
  const { ctx, base, can } = await supplierContext(orgId);
  const inventory = await listInventory(ctx, orgId);
  if (!inventory.ok) return <ErrorState description="We couldn't load inventory." />;
  return (
    <>
      <PageHeader
        title="Inventory"
        description="On hand comes from the stock ledger; reserved is stock committed to accepted orders."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Inventory" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Stock levels" id="levels" className="xl:col-span-2">
          {inventory.value.length ? (
            <InventoryTable rows={inventory.value} productHref={(id) => `${base}/products/${id}`} />
          ) : (
            <EmptyState size="compact" icon={Boxes} title="No products" description="Add products to track stock." />
          )}
        </SectionCard>
        {can("catalog.manage") && (
          <SectionCard title="Record stock" id="record">
            <StockForm inventory={inventory.value} />
          </SectionCard>
        )}
      </div>
    </>
  );
}
