import { CreditCard } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPayments, listSettlements } from "@bahayplus/modules/payments";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PaymentStatusBadge } from "@/components/payments/payment-status";

export const metadata = { title: "Payments" };

export default async function ProviderPaymentsPage({ params }: PageProps<"/provider/o/[orgId]/payments">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("finance.view")) notFound();
  const [payments, settlements] = await Promise.all([
    listPayments(ctx, { organizationId: orgId }),
    listSettlements(ctx, { organizationId: orgId }),
  ]);
  return (
    <>
      <PageHeader
        title="Payments"
        description="Online payments collected by the payment provider for your bookings, and what you are owed. Bahay+ does not hold funds."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Payments" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Payments received" id="payments" className="xl:col-span-2">
          {payments.ok && payments.value.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {payments.value.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/payments/${p.id}`} className="font-medium hover:underline">
                      {p.description}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatPeso(p.amountCentavos)}
                      {p.amountRefundedCentavos ? ` · ${formatPeso(p.amountRefundedCentavos)} refunded` : ""}
                      {p.commissionCentavos !== null ? ` · commission ${formatPeso(p.commissionCentavos)}` : ""} ·{" "}
                      {formatManilaDateTime(p.createdAt)}
                      {p.provider === "sandbox" ? " · sandbox" : ""}
                    </p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="compact"
              icon={CreditCard}
              title="No online payments yet"
              description="Customers can pay confirmed bookings online once payments are enabled."
            />
          )}
        </SectionCard>
        <SectionCard title="Settlements" id="settlements">
          {settlements.ok && settlements.value.length ? (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {settlements.value.map((s) => (
                <li key={s.id} className="py-2.5">
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-medium">Up to {formatManilaDate(s.periodEnd)}</span>
                    <StatusBadge status={s.status} label={s.status === "paid_out" ? "Paid out" : undefined} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gross {formatPeso(s.grossCentavos)} − refunds {formatPeso(s.refundsCentavos)} − commission{" "}
                    {formatPeso(s.commissionCentavos)} = <strong>{formatPeso(s.netCentavos)}</strong>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No settlements yet.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
