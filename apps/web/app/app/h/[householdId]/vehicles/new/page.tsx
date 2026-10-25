import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CreateVehicleForm } from "@/components/registry/vehicle-forms";
import { requireHouseholdAccess } from "@/lib/auth/context";

export const metadata = { title: "Add vehicle" };

export default async function NewVehiclePage({ params }: PageProps<"/app/h/[householdId]/vehicles/new">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.manage")) notFound();
  const base = `/app/h/${householdId}`;
  return (
    <>
      <PageHeader
        title="Add vehicle"
        breadcrumbs={[{ label: "Home", href: base }, { label: "Vehicles", href: `${base}/vehicles` }, { label: "Add" }]}
      />
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <CreateVehicleForm householdId={householdId} />
      </div>
    </>
  );
}
