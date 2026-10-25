import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPurchaseOrders, listSuppliers } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { OrderList } from "@/components/supply/order-display";

export const metadata = { title: "Purchasing" };

export default async function PurchasingPage({ params }: PageProps<"/provider/o/[orgId]/purchasing">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("purchasing.manage")) notFound();
  const [orders, suppliers] = await Promise.all([listPurchaseOrders(ctx, { buyerOrgId: orgId }), listSuppliers(ctx)]);
  return (
    <>
      <PageHeader
        title="Purchasing"
        description="Order materials from suppliers on Bahay+."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Purchasing" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Your purchase orders" id="orders" className="xl:col-span-2">
          {orders.ok && orders.value.length ? (
            <OrderList orders={orders.value} hrefBase={`${base}/purchasing/orders`} counterparty="supplier" />
          ) : (
            <EmptyState
              size="compact"
              icon={ShoppingCart}
              title="No purchase orders yet"
              description="Choose a supplier to place your first order."
            />
          )}
        </SectionCard>
        <SectionCard title="Suppliers" id="suppliers">
          {suppliers.ok && suppliers.value.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {suppliers.value.map((s) => (
                <li key={s.organizationId} className="py-2.5">
                  <Link
                    href={`${base}/purchasing/suppliers/${s.organizationId}`}
                    className="inline-flex min-h-6 items-center font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {s.deliveryAreas || "Delivery areas not listed"}
                    {s.minOrderCentavos ? ` · min. ${formatPeso(s.minOrderCentavos)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No suppliers are listed yet.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
