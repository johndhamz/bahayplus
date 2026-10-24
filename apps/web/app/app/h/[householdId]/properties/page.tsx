import { Archive, Building2, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listProperties } from "@bahayplus/modules/properties";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { cn } from "@bahayplus/ui/lib/utils";
import { PropertyCard } from "@/components/households/property-card";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Properties" };

export default async function PropertiesPage({ params, searchParams }: PageProps<"/app/h/[householdId]/properties">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("property.view")) notFound();
  const showArchived = (await searchParams).view === "archived";
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const result = await listProperties(ctx, householdId, { includeArchived: true });
  const canManage = access.permissions.has("property.manage");

  const all = result.ok ? result.value : [];
  const shown = all.filter((p) => (showArchived ? p.archivedAt : !p.archivedAt));
  const archivedCount = all.filter((p) => p.archivedAt).length;

  return (
    <>
      <PageHeader
        title="Properties"
        description="Homes and units this household manages."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Properties" }]}
        actions={
          canManage ? (
            <Button asChild>
              <Link href={`${base}/properties/new`}>
                <Plus aria-hidden="true" /> Add property
              </Link>
            </Button>
          ) : undefined
        }
      />
      <nav aria-label="Property filter" className="mb-4 flex gap-2">
        {[
          { label: "Active", href: `${base}/properties`, current: !showArchived },
          { label: `Archived (${archivedCount})`, href: `${base}/properties?view=archived`, current: showArchived },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium",
              tab.current ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {!result.ok ? (
        <ErrorState description="We couldn't load properties." />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={showArchived ? Archive : Building2}
          title={showArchived ? "No archived properties" : "No properties yet"}
          description={
            showArchived
              ? "Properties you archive are kept here with their history."
              : canManage
                ? "Add your first property to organise bills, assets and services by location."
                : "An owner or manager can add properties for this household."
          }
          action={
            !showArchived && canManage ? (
              <Button asChild>
                <Link href={`${base}/properties/new`}>Add property</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id}>
              <PropertyCard property={p} href={`${base}/properties/${p.id}`} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
