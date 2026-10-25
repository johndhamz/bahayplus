import { notFound } from "next/navigation";
import {
  getBill,
  listBillPayments,
  listBillReminders,
  PAYMENT_METHOD_LABELS,
  periodLabel,
  reminderOffsetLabel,
} from "@bahayplus/modules/bills";
import { listFiles } from "@bahayplus/modules/files";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import {
  CancelReminderButton,
  RecordPaymentForm,
  SetBillAmountForm,
  VoidPaymentButton,
} from "@/components/finance/bill-forms";
import { PageHeader } from "@/components/layout/page-header";
import { AttachmentList } from "@/components/registry/attachment-list";
import { FileUpload } from "@/components/registry/file-upload";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Bill" };

const toInput = (c: number | null) => (c === null ? "" : formatPeso(c).replace("₱", ""));

export default async function BillPage({ params }: PageProps<"/app/h/[householdId]/bills/[billId]">) {
  const { householdId, billId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("bills.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getBill(ctx, billId);
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const bill = result.value;
  const [payments, reminders, files] = await Promise.all([
    listBillPayments(ctx, billId),
    listBillReminders(ctx, billId),
    listFiles(ctx, "bill", billId),
  ]);
  const canManage = access.permissions.has("bills.manage");
  const today = manilaDateOf(new Date());
  const base = `/app/h/${householdId}`;

  return (
    <>
      <PageHeader
        title={`${bill.accountLabel} — ${periodLabel(bill.periodKey)}`}
        eyebrow={`Due ${formatManilaDate(bill.dueOn)}`}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Bills", href: `${base}/bills` },
          { label: periodLabel(bill.periodKey) },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge
          status={bill.displayStatus}
          label={bill.displayStatus === "awaiting_amount" ? "Needs amount" : undefined}
        />
        {bill.creditCentavos > 0 && (
          <StatusBadge status="info" tone="info" label={`Credit ${formatPeso(bill.creditCentavos)}`} />
        )}
      </div>
      <section aria-label="Bill amounts" className="mb-4 grid grid-cols-3 gap-3">
        <StatCard
          label="Amount due"
          value={bill.amountDueCentavos === null ? "—" : formatPeso(bill.amountDueCentavos)}
        />
        <StatCard label="Paid" value={formatPeso(bill.amountPaidCentavos)} />
        <StatCard
          label="Remaining"
          value={bill.remainingCentavos === null ? "—" : formatPeso(bill.remainingCentavos)}
          tone={bill.remainingCentavos ? "terracotta" : "default"}
        />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {canManage && (
            <SectionCard
              title={bill.amountDueCentavos === null ? "Enter the statement amount" : "Statement amount"}
              id="amount"
            >
              <SetBillAmountForm billId={billId} current={toInput(bill.amountDueCentavos)} />
            </SectionCard>
          )}
          {canManage && bill.status !== "paid" && bill.amountDueCentavos !== null && (
            <SectionCard title="Record a payment" id="record">
              <RecordPaymentForm billId={billId} remaining={toInput(bill.remainingCentavos)} today={today} />
            </SectionCard>
          )}
          <SectionCard title="Payments" id="payments">
            {payments.ok && payments.value.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {payments.value.map((p) => (
                  <li key={p.id} className={`flex items-center gap-3 py-2.5 ${p.voidedAt ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold tabular-nums ${p.voidedAt ? "line-through" : ""}`}>
                        {formatPeso(p.amountCentavos)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatManilaDate(p.paidOn)} · {PAYMENT_METHOD_LABELS[p.method]}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {p.voidedAt ? ` · Voided: ${p.voidReason}` : ""}
                      </p>
                    </div>
                    {canManage && !p.voidedAt && <VoidPaymentButton paymentId={p.id} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="Reminders" id="reminders">
            {reminders.ok && reminders.value.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {reminders.value.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{reminderOffsetLabel(r.offsetDays)}</p>
                      <p className="text-xs text-muted-foreground">{formatManilaDate(r.remindOn)}</p>
                    </div>
                    <StatusBadge
                      status={r.status}
                      tone={r.status === "scheduled" ? "info" : r.status === "sent" ? "success" : "neutral"}
                      label={r.status === "cancelled" && r.cancelReason === "paid" ? "Stopped (paid)" : undefined}
                    />
                    {canManage && r.status === "scheduled" && <CancelReminderButton reminderId={r.id} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No reminders for this bill.</p>
            )}
          </SectionCard>
          <SectionCard title="Statements & receipts" id="files">
            {canManage && (
              <FileUpload
                householdId={householdId}
                entityType="bill"
                entityId={billId}
                purpose="statement"
                label="Upload statement or receipt"
              />
            )}
            <AttachmentList files={files.ok ? files.value : []} canManage={canManage} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
