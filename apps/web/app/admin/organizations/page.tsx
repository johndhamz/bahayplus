import { listOrganizationsForAdmin } from "@bahayplus/modules/admin";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDate } from "@bahayplus/types/dates";
import { OrganizationStatusAction } from "@/components/admin/admin-forms";
import { adminContext } from "@/components/admin/admin-guard";
import { selectClassName } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Organizations" };

export default async function AdminOrganizationsPage({ searchParams }: PageProps<"/admin/organizations">) {
  const sp = await searchParams;
  const { ctx, can } = await adminContext("platform.access");
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const kind = ["service_provider", "supplier"].includes(str(sp.kind) ?? "") ? str(sp.kind) : undefined;
  const status = ["active", "suspended"].includes(str(sp.status) ?? "") ? str(sp.status) : undefined;
  const orgs = await listOrganizationsForAdmin(ctx, { search: str(sp.q), kind, status });
  const canManage = can("platform.organizations.manage");
  return (
    <>
      <PageHeader title="Organizations" description="Service providers and suppliers on Bahay+." />
      <form
        method="get"
        role="search"
        className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-4 sm:items-end"
      >
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Search
          <input name="q" defaultValue={str(sp.q)} className={selectClassName} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select name="kind" defaultValue={kind ?? ""} className={selectClassName}>
            <option value="">All</option>
            <option value="service_provider">Service providers</option>
            <option value="supplier">Suppliers</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={status ?? ""} className={selectClassName}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <Button type="submit" variant="outline" className="sm:col-start-4">
          Filter
        </Button>
      </form>
      {!orgs.ok ? (
        <ErrorState description="We couldn't load organizations." />
      ) : (
        <SectionCard title={`${orgs.value.length} organization(s)`} id="orgs">
          <ul className="flex flex-col divide-y divide-border">
            {orgs.value.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.kind === "service_provider" ? "Service provider" : "Supplier"} · {o.memberCount} member(s) ·
                    joined {formatManilaDate(new Date(o.createdAt))}
                    {o.verificationStatus ? ` · verification ${o.verificationStatus.replace("_", " ")}` : ""}
                    {o.verifiedUntil ? ` until ${formatManilaDate(o.verifiedUntil)}` : ""}
                  </p>
                </div>
                {o.listed && <StatusBadge status="listed" tone="success" label="Listed" />}
                <StatusBadge status={o.status} tone={o.status === "active" ? "success" : "warning"} />
                {canManage && <OrganizationStatusAction organizationId={o.id} name={o.name} status={o.status} />}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
