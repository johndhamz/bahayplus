import { PawPrint, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPets, petAge, PET_SPECIES_LABELS } from "@bahayplus/modules/pets";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { manilaDateOf } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Pets" };

export default async function PetsPage({ params }: PageProps<"/app/h/[householdId]/pets">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.view")) notFound();
  const ctx = await requireServiceContext();
  const pets = await listPets(ctx, householdId);
  const base = `/app/h/${householdId}`;
  const canManage = access.permissions.has("registry.manage");
  const today = manilaDateOf(new Date());
  return (
    <>
      <PageHeader
        title="Pets"
        description="Profiles, care preferences, vaccinations and vet visits."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Pets" }]}
        actions={
          canManage ? (
            <Button asChild>
              <Link href={`${base}/pets/new`}>
                <Plus aria-hidden="true" /> Add pet
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!pets.ok ? (
        <ErrorState description="We couldn't load pets." />
      ) : pets.value.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="No pets yet"
          description="Add your dogs, cats and other pets to track vaccinations and grooming."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.value.map((p) => (
            <li key={p.id}>
              <Link
                href={`${base}/pets/${p.id}`}
                className="flex h-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-brand/40"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sage text-brand">
                  <PawPrint aria-hidden="true" className="size-6" />
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-semibold">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[PET_SPECIES_LABELS[p.species], p.breed, petAge(p.birthDate, today)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
