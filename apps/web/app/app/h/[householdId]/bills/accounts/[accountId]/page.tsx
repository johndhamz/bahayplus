import { notFound } from "next/navigation";
import { BILL_TYPE_LABELS, getBillAccount, listBills } from "@bahayplus/modules/bills";
import { listCategories } from "@bahayplus/modules/budgets";
import { listProperties } from "@bahayplus/modules/properties";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { manilaDateOf } from "@bahayplus/types/dates";
import { EditBillAccountForm } from "@/components/finance/bill-account-forms";
import { CreateOneOffBillForm } from "@/components/finance/bill-forms";
import { BillRow } from "@/components/finance/bill-row";
import { PageHeader } from "@/components/layout/page-header";
import { ArchiveToggle } from "@/components/registry/archive-toggle";
import { archiveBillAccountAction } from "@/lib/actions/finance";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Bill account" };

export default async function BillAccountPage({
  params,
}: PageProps<"/app/h/[householdId]/bills/accounts/[accountId]">) {
  const { householdId, accountId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("bills.view")) notFound();
  const ctx = await requireServiceContext();
  const account = await getBillAccount(ctx, accountId);
  if (!account.ok || account.value.householdId !== householdId) notFound();
  const a = account.value;
  const canManage = access.permissions.has("bills.manage") && !a.archivedAt;
  const [bills, properties, categories] = await Promise.all([
    listBills(ctx, householdId, { accountId, limit: 36 }),
    canManage ? listProperties(ctx, householdId) : null,
    canManage ? listCategories(ctx, householdId) : null,
  ]);
  const base = `/app/h/${householdId}`;
  const sorted = bills.ok ? [...bills.value].sort((x, y) => y.dueOn.localeCompare(x.dueOn)) : [];

  return (
    <>
      <PageHeader
        title={a.nickname || a.providerName}
        eyebrow={`${BILL_TYPE_LABELS[a.billType]}${a.accountNumberLast4 ? ` · ••••${a.accountNumberLast4}` : ""}`}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Bills", href: `${base}/bills` },
          { label: a.nickname || a.providerName },
        ]}
        actions={
          canManage ? (
            <ArchiveToggle
              archived={!!a.archivedAt}
              label={a.nickname || a.providerName}
              description="Stops new bills and reminders for this account. Past bills and payments are kept."
              archive={archiveBillAccountAction.bind(null, { accountId })}
              restore={archiveBillAccountAction.bind(null, { accountId })}
            />
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Bill history" id="history" className="lg:col-span-2">
          {sorted.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {sorted.map((b) => (
                <li key={b.id}>
                  <BillRow bill={b} href={`${base}/bills/${b.id}`} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No bills yet.</p>
          )}
        </SectionCard>
        {canManage && (
          <SectionCard title="Add a one-off bill" id="one-off">
            <CreateOneOffBillForm accountId={accountId} householdId={householdId} today={manilaDateOf(new Date())} />
          </SectionCard>
        )}
        {canManage && properties?.ok && categories?.ok && (
          <SectionCard title="Account settings" id="settings" className="lg:col-span-3">
            <EditBillAccountForm
              account={a}
              properties={properties.value.map((p) => ({ id: p.id, name: p.name }))}
              categories={categories.value.map((c) => ({ id: c.id, name: c.name }))}
            />
          </SectionCard>
        )}
      </div>
    </>
  );
}
