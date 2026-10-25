import { Truck } from "lucide-react";
import Link from "next/link";
import { formatPoNumber, listDeliveries } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";

export const metadata = { title: "Deliveries" };

const LABEL = { out_for_delivery: "Out for delivery", delivered: "Delivered", failed: "Failed" } as const;
const TONE = { out_for_delivery: "info", delivered: "success", failed: "danger" } as const;

export default async function DeliveriesPage({ params }: PageProps<"/supplier/o/[orgId]/deliveries">) {
  const { orgId } = await params;
  const { ctx, base } = await supplierContext(orgId, "orders.view");
  const deliveries = await listDeliveries(ctx, orgId);
  if (!deliveries.ok) return <ErrorState description="We couldn't load deliveries." />;
  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Shipped orders and their delivery status."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Deliveries" }]}
      />
      <SectionCard title={`Deliveries (${deliveries.value.length})`} id="deliveries">
        {deliveries.value.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {deliveries.value.map((d) => (
              <li key={d.purchaseOrderId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/purchase-orders/${d.purchaseOrderId}`} className="font-medium hover:underline">
                    {formatPoNumber(d.number)} · {d.buyerName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[
                      d.courier,
                      d.trackingRef,
                      d.scheduledFor && `scheduled ${formatManilaDate(d.scheduledFor)}`,
                      d.deliveredAt && `delivered ${formatManilaDateTime(d.deliveredAt)}`,
                      d.failureReason && `failed: ${d.failureReason}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusBadge status={d.status} tone={TONE[d.status]} label={LABEL[d.status]} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            size="compact"
            icon={Truck}
            title="No deliveries yet"
            description="Shipping an accepted order creates a delivery."
          />
        )}
      </SectionCard>
    </>
  );
}
