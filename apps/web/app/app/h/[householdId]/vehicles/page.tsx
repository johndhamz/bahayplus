import { Car, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { classifyDue } from "@bahayplus/modules/scheduling";
import { listVehicles, VEHICLE_TYPE_LABELS, vehicleLabel } from "@bahayplus/modules/vehicles";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { manilaDateOf } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage({ params }: PageProps<"/app/h/[householdId]/vehicles">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.view")) notFound();
  const ctx = await requireServiceContext();
  const vehicles = await listVehicles(ctx, householdId);
  const base = `/app/h/${householdId}`;
  const today = manilaDateOf(new Date());
  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Cars and motorcycles: LTO registration, insurance and service history."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Vehicles" }]}
        actions={
          access.permissions.has("registry.manage") ? (
            <Button asChild>
              <Link href={`${base}/vehicles/new`}>
                <Plus aria-hidden="true" /> Add vehicle
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!vehicles.ok ? (
        <ErrorState description="We couldn't load vehicles." />
      ) : vehicles.value.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          description="Add your car or motorcycle to track LTO registration, insurance and maintenance."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {vehicles.value.map((v) => {
            const reg = v.registrationExpiresOn ? classifyDue(v.registrationExpiresOn, today) : null;
            return (
              <li key={v.id}>
                <Link
                  href={`${base}/vehicles/${v.id}`}
                  className="flex h-full gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-brand/40"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage text-brand">
                    <Car aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading font-semibold">{vehicleLabel(v)}</span>
                    <span className="block text-xs text-terracotta-strong">{VEHICLE_TYPE_LABELS[v.vehicleType]}</span>
                    {reg && (
                      <StatusBadge
                        className="mt-2"
                        status={reg.status}
                        tone={reg.status === "overdue" ? "danger" : reg.status === "upcoming" ? "success" : "warning"}
                        label={
                          reg.status === "overdue"
                            ? "Registration expired"
                            : reg.status === "upcoming"
                              ? "Registered"
                              : `Registration due in ${reg.days} days`
                        }
                      />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
