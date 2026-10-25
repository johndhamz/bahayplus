import { notFound } from "next/navigation";
import { listProperties } from "@bahayplus/modules/properties";
import { getHouseholdOverview } from "@bahayplus/modules/households";
import { PageHeader } from "@/components/layout/page-header";
import { CreateAssetForm } from "@/components/registry/asset-forms";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Add item" };

export default async function NewAssetPage({ params }: PageProps<"/app/h/[householdId]/assets/new">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.manage")) notFound();
  const ctx = await requireServiceContext();
  const [properties, overview] = await Promise.all([
    listProperties(ctx, householdId),
    getHouseholdOverview(ctx, access),
  ]);
  const base = `/app/h/${householdId}`;
  return (
    <>
      <PageHeader
        title="Add item"
        breadcrumbs={[{ label: "Home", href: base }, { label: "Assets", href: `${base}/assets` }, { label: "Add" }]}
      />
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <CreateAssetForm
          householdId={householdId}
          properties={properties.ok ? properties.value.map((p) => ({ id: p.id, name: p.name })) : []}
          defaultPropertyId={overview.ok ? overview.value.defaultPropertyId : null}
        />
      </div>
    </>
  );
}
