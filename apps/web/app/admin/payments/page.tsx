import { listOrganizationsForAdmin } from "@bahayplus/modules/admin";
import { listPayments, listSettlements } from "@bahayplus/modules/payments";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, formatManilaDateTime, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { adminContext } from "@/components/admin/admin-guard";
import { PageHeader } from "@/components/layout/page-header";
import {
  CommissionForm,
  CreateSettlementForm,
  ReconciliationForm,
  SettlementActions,
} from "@/components/payments/admin-finance";
import { PaymentStatusBadge } from "@/components/payments/payment-status";
import { paymentProvider } from "@/lib/payments/provider";

export const metadata = { title: "Payments & settlements" };

export default async function AdminPaymentsPage() {
  const { ctx } = await adminContext("platform.finance.manage");
  const today = manilaDateOf(new Date());
  const [payments, settlements, orgs, defaultRate] = await Promise.all([
    listPayments(ctx, { all: true }, 50),
    listSettlements(ctx, { all: true }),
    listOrganizationsForAdmin(ctx, { kind: "service_provider" }),
    ctx.db
      .from("commission_rates")
      .select("rate_bps")
      .is("organization_id", null)
      .lte("effective_from", today)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const providers = (orgs.ok ? orgs.value : []).map((o) => ({ id: o.id, name: o.name }));
  const orgName = new Map(providers.map((o) => [o.id, o.name]));
  const provider = paymentProvider();
  return (
    <>
      <PageHeader
        title="Payments & settlements"
        description={`Provider: ${provider ? provider.label : "none configured — online payments are disabled"}. Bahay+ records payments and settlements; the licensed partner moves the money.`}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Create a settlement" id="create-settlement">
          <CreateSettlementForm organizations={providers} today={today} />
          <p className="text-xs text-muted-foreground">
            Includes unsettled successful payments up to the period end, and refunds made after earlier settlements.
          </p>
        </SectionCard>
        <SectionCard title="Commission" id="commission">
          <CommissionForm organizations={providers} today={today} currentDefaultBps={defaultRate.data?.rate_bps ?? 0} />
          <p className="text-xs text-muted-foreground">
            Current platform default: {((defaultRate.data?.rate_bps ?? 0) / 100).toFixed(2)}%. Rates can&apos;t be
            backdated; each payment keeps the rate in force when it succeeded.
          </p>
        </SectionCard>
        <SectionCard title="Settlements" id="settlements" className="xl:col-span-2">
          {settlements.ok && settlements.value.length ? (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {settlements.value.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {orgName.get(s.organizationId) ?? "Business"} · up to {formatManilaDate(s.periodEnd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.itemCount} item(s) · gross {formatPeso(s.grossCentavos)} − refunds{" "}
                      {formatPeso(s.refundsCentavos)} − commission {formatPeso(s.commissionCentavos)} ={" "}
                      <strong>{formatPeso(s.netCentavos)}</strong>
                      {s.payoutReference ? ` · payout ${s.payoutReference}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={s.status} label={s.status === "paid_out" ? "Paid out" : undefined} />
                  <SettlementActions settlementId={s.id} status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No settlements yet.</p>
          )}
        </SectionCard>
        <SectionCard title="Reconciliation" id="reconciliation">
          <ReconciliationForm today={today} />
        </SectionCard>
        <SectionCard title="Recent payments" id="payments">
          <ul className="flex flex-col divide-y divide-border text-sm">
            {(payments.ok ? payments.value : []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  {formatPeso(p.amountCentavos)} · {orgName.get(p.organizationId) ?? "Business"}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {p.externalReference ?? "—"} · {formatManilaDateTime(p.createdAt)}
                  </span>
                </span>
                <PaymentStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
