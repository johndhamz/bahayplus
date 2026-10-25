import { Package, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ASSET_CATEGORY_LABELS, listAssets, warrantyStatus } from "@bahayplus/modules/assets";
import { listProperties } from "@bahayplus/modules/properties";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { ASSET_CATEGORIES, type AssetCategory } from "@bahayplus/validation/registry/assets";
import { manilaDateOf } from "@bahayplus/types/dates";
import { selectClassName } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Assets" };

const WARRANTY_BADGE = {
  active: { tone: "success", label: "Under warranty" },
  expiring_soon: { tone: "warning", label: "Warranty ending" },
  expired: { tone: "neutral", label: "Warranty expired" },
} as const;

export default async function AssetsPage({ params, searchParams }: PageProps<"/app/h/[householdId]/assets">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.view")) notFound();
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const category = ASSET_CATEGORIES.includes(sp.category as AssetCategory) ? (sp.category as AssetCategory) : undefined;
  const propertyId = typeof sp.property === "string" && sp.property ? sp.property : undefined;
  const archived = sp.view === "archived";
  const [assets, properties] = await Promise.all([
    listAssets(ctx, householdId, { category, propertyId, includeArchived: archived }),
    access.permissions.has("property.view") ? listProperties(ctx, householdId, { includeArchived: true }) : null,
  ]);
  const today = manilaDateOf(new Date());
  const canManage = access.permissions.has("registry.manage");
  const shown = assets.ok ? assets.value.filter((a) => (archived ? a.archivedAt : !a.archivedAt)) : [];

  return (
    <>
      <PageHeader
        title="Assets"
        description="Appliances and equipment, with warranties and maintenance history."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Assets" }]}
        actions={
          canManage ? (
            <Button asChild>
              <Link href={`${base}/assets/new`}>
                <Plus aria-hidden="true" /> Add item
              </Link>
            </Button>
          ) : undefined
        }
      />
      <form
        method="get"
        className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select name="category" defaultValue={category ?? ""} className={selectClassName}>
            <option value="">All categories</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ASSET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        {properties?.ok && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Property
            <select name="property" defaultValue={propertyId ?? ""} className={selectClassName}>
              <option value="">All properties</option>
              {properties.value.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.archivedAt ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="view"
            value="archived"
            defaultChecked={archived}
            className="size-5 accent-[var(--brand)]"
          />
          Archived only
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>
      {!assets.ok ? (
        <ErrorState description="We couldn't load assets." />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            archived ? "No archived items" : category || propertyId ? "No items match these filters" : "No items yet"
          }
          description={
            archived
              ? "Archived items keep their history here."
              : "Track appliances like aircons, refrigerators and water heaters to never miss a warranty or cleaning."
          }
          action={
            !archived && canManage ? (
              <Button asChild>
                <Link href={`${base}/assets/new`}>Add item</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((a) => {
            const w = warrantyStatus(a.warrantyExpiresOn, today);
            return (
              <li key={a.id}>
                <Link
                  href={`${base}/assets/${a.id}`}
                  className="flex h-full gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-brand/40"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage text-brand">
                    <Package aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading font-semibold">{a.name}</span>
                    <span className="block text-xs text-terracotta-strong">
                      {ASSET_CATEGORY_LABELS[a.category]}
                      {a.propertyName ? ` · ${a.propertyName}` : ""}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {[a.brand, a.model].filter(Boolean).join(" ")}
                    </span>
                    {w.state !== "none" && (
                      <StatusBadge
                        className="mt-2"
                        status={w.state}
                        tone={WARRANTY_BADGE[w.state].tone}
                        label={WARRANTY_BADGE[w.state].label}
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
