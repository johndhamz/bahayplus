import { AlertTriangle, Plus, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BILL_TYPE_LABELS, listBillAccounts, listBills, type BillFilter } from "@bahayplus/modules/bills";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { cn } from "@bahayplus/ui/lib/utils";
import { addDays, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { BillRow } from "@/components/finance/bill-row";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Bills" };

const TABS = [
  { key: "open", label: "Due" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
] as const;

export default async function BillsPage({ params, searchParams }: PageProps<"/app/h/[householdId]/bills">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("bills.view")) notFound();
  const ctx = await requireServiceContext();
  const requestedTab = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requestedTab)?.key ?? "open";
  const today = manilaDateOf(new Date());
  const base = `/app/h/${householdId}`;
  const filter: BillFilter =
    tab === "open" ? { status: "open", toDue: addDays(today, 45) } : { status: tab, limit: 60 };
  const [bills, overdue, accounts] = await Promise.all([
    listBills(ctx, householdId, filter),
    listBills(ctx, householdId, { status: "overdue" }),
    listBillAccounts(ctx, householdId),
  ]);
  const canManage = access.permissions.has("bills.manage");
  const openBills = tab === "open" && bills.ok ? bills.value : [];
  const totalDue = openBills.reduce((sum, b) => sum + (b.remainingCentavos ?? 0), 0);
  const overdueCount = overdue.ok ? overdue.value.length : 0;

  return (
    <>
      <PageHeader
        title="Bills"
        description="Track utilities and dues, and record payments you make through GCash, banks or payment centers."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Bills" }]}
        actions={
          canManage ? (
            <Button asChild>
              <Link href={`${base}/bills/accounts/new`}>
                <Plus aria-hidden="true" /> Add bill
              </Link>
            </Button>
          ) : undefined
        }
      />
      <section aria-label="Bills summary" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Due in the next 45 days"
          value={tab === "open" ? formatPeso(totalDue) : "—"}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          tone={overdueCount ? "terracotta" : "default"}
          href={`${base}/bills?tab=overdue`}
        />
        <StatCard
          label="Accounts"
          value={accounts.ok ? accounts.value.length : "—"}
          icon={Receipt}
          className="hidden lg:flex"
        />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Bills" id="bills" className="lg:col-span-2">
          <nav aria-label="Bill status" className="flex gap-2">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`${base}/bills?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium",
                  tab === t.key
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.key === "overdue" && overdueCount > 0 ? ` (${overdueCount})` : ""}
              </Link>
            ))}
          </nav>
          {!bills.ok ? (
            <ErrorState description="We couldn't load bills." />
          ) : bills.value.length === 0 ? (
            <EmptyState
              size="compact"
              icon={Receipt}
              title={
                tab === "overdue"
                  ? "Nothing overdue"
                  : tab === "paid"
                    ? "No paid bills yet"
                    : accounts.ok && accounts.value.length
                      ? "Nothing due soon"
                      : "No bills yet"
              }
              description={
                tab === "open" && !(accounts.ok && accounts.value.length)
                  ? "Add Meralco, water, internet, dues or rent to see what's due."
                  : undefined
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {bills.value.map((b) => (
                <li key={b.id}>
                  <BillRow bill={b} href={`${base}/bills/${b.id}`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Accounts" id="accounts">
          {accounts.ok && accounts.value.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {accounts.value.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`${base}/bills/accounts/${a.id}`}
                    className="flex min-h-11 flex-col justify-center rounded-lg px-2 hover:bg-muted/60"
                  >
                    <span className="text-sm font-medium">{a.nickname || a.providerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {BILL_TYPE_LABELS[a.billType]}
                      {a.accountNumberLast4 ? ` · ••••${a.accountNumberLast4}` : ""}
                      {a.isRecurring && a.dueDay
                        ? ` · due every ${a.dueDay === 31 ? "last day" : `day ${a.dueDay}`}`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
