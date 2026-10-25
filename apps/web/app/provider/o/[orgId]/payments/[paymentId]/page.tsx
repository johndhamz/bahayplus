import { notFound } from "next/navigation";
import { getPayment, listPaymentEvents, listRefunds, refundableCentavos } from "@bahayplus/modules/payments";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { RefundForm } from "@/components/payments/payment-forms";
import { PaymentStatusBadge } from "@/components/payments/payment-status";

export const metadata = { title: "Payment" };

export default async function ProviderPaymentPage({ params }: PageProps<"/provider/o/[orgId]/payments/[paymentId]">) {
  const { orgId, paymentId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("finance.view")) notFound();
  const payment = await getPayment(ctx, paymentId);
  if (!payment.ok || payment.value.organizationId !== orgId) notFound();
  const p = payment.value;
  const [refunds, events] = await Promise.all([listRefunds(ctx, paymentId), listPaymentEvents(ctx, paymentId)]);
  const committed = (refunds.ok ? refunds.value : [])
    .filter((r) => r.status !== "failed")
    .reduce((s, r) => s + r.amountCentavos, 0);
  const refundable = refundableCentavos(p.amountCentavos, committed);
  return (
    <>
      <PageHeader
        title={p.description}
        eyebrow={formatPeso(p.amountCentavos)}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Payments", href: `${base}/payments` },
          { label: "Payment" },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={p.status} />
        {p.provider === "sandbox" && <StatusBadge status="sandbox" tone="warning" label="Sandbox — no real money" />}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {access.permissions.has("payments.refund") &&
            ["succeeded", "partially_refunded"].includes(p.status) &&
            refundable > 0 && (
              <SectionCard title="Issue a refund" id="refund">
                <RefundForm paymentIntentId={p.id} refundableCentavos={refundable} />
              </SectionCard>
            )}
          <SectionCard title="Refunds" id="refunds">
            {refunds.ok && refunds.value.length ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {refunds.value.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1">
                      {formatPeso(r.amountCentavos)} · {r.reason}
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No refunds.</p>
            )}
          </SectionCard>
        </div>
        <SectionCard title="Payment history" id="history">
          <ol className="flex flex-col gap-2 border-l-2 border-sage pl-3 text-sm">
            {(events.ok ? events.value : []).map((e) => (
              <li key={e.id}>
                <p className="font-medium">
                  {e.eventType.replace(".", " ").replaceAll("_", " ")}
                  {e.amountCentavos !== null ? ` · ${formatPeso(e.amountCentavos)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatManilaDateTime(e.createdAt)} · {e.source}
                </p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}
