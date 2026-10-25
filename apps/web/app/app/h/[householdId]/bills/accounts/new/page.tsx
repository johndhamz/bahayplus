import { notFound } from "next/navigation";
import { listCategories } from "@bahayplus/modules/budgets";
import { getHouseholdOverview } from "@bahayplus/modules/households";
import { listProperties } from "@bahayplus/modules/properties";
import { CreateBillAccountForm } from "@/components/finance/bill-account-forms";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Add bill" };

export default async function NewBillAccountPage({ params }: PageProps<"/app/h/[householdId]/bills/accounts/new">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("bills.manage")) notFound();
  const ctx = await requireServiceContext();
  const [properties, categories, overview] = await Promise.all([
    listProperties(ctx, householdId),
    listCategories(ctx, householdId),
    getHouseholdOverview(ctx, access),
  ]);
  const base = `/app/h/${householdId}`;
  return (
    <>
      <PageHeader
        title="Add bill"
        breadcrumbs={[{ label: "Home", href: base }, { label: "Bills", href: `${base}/bills` }, { label: "Add" }]}
      />
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <CreateBillAccountForm
          householdId={householdId}
          properties={properties.ok ? properties.value.map((p) => ({ id: p.id, name: p.name })) : []}
          categories={categories.ok ? categories.value.map((c) => ({ id: c.id, name: c.name })) : []}
          defaultPropertyId={overview.ok ? overview.value.defaultPropertyId : null}
        />
      </div>
    </>
  );
}
