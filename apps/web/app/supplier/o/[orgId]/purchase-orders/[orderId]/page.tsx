import { notFound } from "next/navigation";
import { formatPoNumber, getPurchaseOrder } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { OrderActions } from "@/components/supply/order-actions";
import { OrderFacts, OrderLines, OrderStatusBadge } from "@/components/supply/order-display";

export const metadata = { title: "Purchase order" };

export default async function SupplierOrderPage({
  params,
}: PageProps<"/supplier/o/[orgId]/purchase-orders/[orderId]">) {
  const { orgId, orderId } = await params;
  const { ctx, base, can } = await supplierContext(orgId, "orders.view");
  const order = await getPurchaseOrder(ctx, orderId);
  if (!order.ok || order.value.supplierOrgId !== orgId) notFound();
  const o = order.value;
  return (
    <>
      <PageHeader
        title={formatPoNumber(o.number)}
        eyebrow={o.buyerName}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Purchase orders", href: `${base}/purchase-orders` },
          { label: formatPoNumber(o.number) },
        ]}
      />
      <div className="mb-4">
        <OrderStatusBadge status={o.status} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Items" id="items" className="xl:col-span-2">
          <OrderLines order={o} />
        </SectionCard>
        <div className="flex flex-col gap-4">
          {can("orders.manage") && (
            <SectionCard title="Actions" id="actions">
              <OrderActions orderId={o.id} status={o.status} side="supplier" delivery={o.delivery?.status ?? null} />
            </SectionCard>
          )}
          <SectionCard title="Details" id="details">
            <OrderFacts order={o} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
