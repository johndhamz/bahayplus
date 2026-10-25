import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CreatePetForm } from "@/components/registry/pet-forms";
import { requireHouseholdAccess } from "@/lib/auth/context";

export const metadata = { title: "Add pet" };

export default async function NewPetPage({ params }: PageProps<"/app/h/[householdId]/pets/new">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.manage")) notFound();
  const base = `/app/h/${householdId}`;
  return (
    <>
      <PageHeader
        title="Add pet"
        breadcrumbs={[{ label: "Home", href: base }, { label: "Pets", href: `${base}/pets` }, { label: "Add" }]}
      />
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <CreatePetForm householdId={householdId} />
      </div>
    </>
  );
}
