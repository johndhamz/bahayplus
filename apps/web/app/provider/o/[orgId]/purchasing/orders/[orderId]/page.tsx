import { notFound } from "next/navigation";
import { formatPoNumber, getPurchaseOrder } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { OrderActions } from "@/components/supply/order-actions";
import { OrderFacts, OrderLines, OrderStatusBadge } from "@/components/supply/order-display";

export const metadata = { title: "Purchase order" };

export default async function BuyerOrderPage({ params }: PageProps<"/provider/o/[orgId]/purchasing/orders/[orderId]">) {
  const { orgId, orderId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("purchasing.manage")) notFound();
  const order = await getPurchaseOrder(ctx, orderId);
  if (!order.ok || order.value.buyerOrgId !== orgId) notFound();
  const o = order.value;
  return (
    <>
      <PageHeader
        title={formatPoNumber(o.number)}
        eyebrow={o.supplierName}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Purchasing", href: `${base}/purchasing` },
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
          <SectionCard title="Actions" id="actions">
            <OrderActions orderId={o.id} status={o.status} side="buyer" delivery={o.delivery?.status ?? null} />
          </SectionCard>
          <SectionCard title="Details" id="details">
            <OrderFacts order={o} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
