import { listCategoriesForAdmin } from "@bahayplus/modules/admin";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { CategoryRowActions, NewCategoryForm } from "@/components/admin/admin-forms";
import { adminContext } from "@/components/admin/admin-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Service categories" };

const DIVISIONS = { home: "Home", pet: "Pet", vehicle: "Vehicle", renovation: "Renovation" } as Record<string, string>;

export default async function AdminCategoriesPage() {
  const { ctx, can } = await adminContext("platform.access");
  const categories = await listCategoriesForAdmin(ctx);
  const canManage = can("platform.categories.manage");
  if (!categories.ok) return <ErrorState description="We couldn't load categories." />;
  return (
    <>
      <PageHeader
        title="Service categories"
        description="The catalog providers choose from. Deactivated categories are hidden from customers."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {Object.entries(DIVISIONS).map(([key, label]) => (
            <SectionCard key={key} title={label} id={`div-${key}`}>
              <ul className="flex flex-col divide-y divide-border">
                {categories.value
                  .filter((c) => c.division === key)
                  .map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.slug}
                          {c.description ? ` · ${c.description}` : ""}
                        </p>
                      </div>
                      {c.urgentEligible && !canManage && <StatusBadge status="urgent" tone="warning" label="Urgent" />}
                      {!c.isActive && <StatusBadge status="inactive" />}
                      {canManage && <CategoryRowActions category={c} />}
                    </li>
                  ))}
              </ul>
            </SectionCard>
          ))}
        </div>
        {canManage && (
          <SectionCard title="Add a category" id="add">
            <NewCategoryForm />
          </SectionCard>
        )}
      </div>
    </>
  );
}
