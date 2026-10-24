import { notFound } from "next/navigation";
import { CreatePropertyForm } from "@/components/households/property-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess } from "@/lib/auth/context";

export const metadata = { title: "Add property" };

export default async function NewPropertyPage({ params }: PageProps<"/app/h/[householdId]/properties/new">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("property.manage")) notFound();
  const base = `/app/h/${householdId}`;
  return (
    <>
      <PageHeader
        title="Add property"
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Properties", href: `${base}/properties` },
          { label: "Add" },
        ]}
      />
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <CreatePropertyForm householdId={householdId} />
      </div>
    </>
  );
}
