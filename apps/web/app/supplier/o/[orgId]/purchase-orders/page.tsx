import { ShoppingCart } from "lucide-react";
import { listPurchaseOrders } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { OrderList } from "@/components/supply/order-display";

export const metadata = { title: "Purchase orders" };

export default async function SupplierOrdersPage({ params }: PageProps<"/supplier/o/[orgId]/purchase-orders">) {
  const { orgId } = await params;
  const { ctx, base } = await supplierContext(orgId, "orders.view");
  const orders = await listPurchaseOrders(ctx, { supplierOrgId: orgId });
  if (!orders.ok) return <ErrorState description="We couldn't load orders." />;
  const groups = [
    { id: "new", title: "New", items: orders.value.filter((o) => o.status === "submitted") },
    { id: "fulfil", title: "To ship", items: orders.value.filter((o) => o.status === "accepted") },
    { id: "transit", title: "Out for delivery", items: orders.value.filter((o) => o.status === "shipped") },
    {
      id: "closed",
      title: "Closed",
      items: orders.value.filter((o) => ["delivered", "rejected", "cancelled"].includes(o.status)),
    },
  ];
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders from service providers."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Purchase orders" }]}
      />
      {orders.value.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          titleAs="h2"
          title="No orders yet"
          description="Orders appear here when service providers buy from your catalog."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <SectionCard key={g.id} title={`${g.title} (${g.items.length})`} id={g.id}>
              {g.items.length ? (
                <OrderList orders={g.items} hrefBase={`${base}/purchase-orders`} counterparty="buyer" />
              ) : (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
            </SectionCard>
          ))}
        </div>
      )}
    </>
  );
}
