import Link from "next/link";
import { notFound } from "next/navigation";
import { listQuotations, listWorkOrders } from "@bahayplus/modules/bookings";
import { getProject, listChangeOrders, listMilestones, listProjectUpdates } from "@bahayplus/modules/projects";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDate } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import {
  changeOrderAmount,
  ProjectStatusBadge,
  ProjectUpdates,
  toManilaLocal,
} from "@/components/transactions/display";
import {
  AddMilestoneForm,
  MilestoneList,
  PostUpdateForm,
  PROJECT_KIND_LABELS,
  ProjectPlanForm,
  ProjectStatusActions,
  ProposeChangeOrderForm,
} from "@/components/transactions/project-forms";
import { WORK_ORDER_STATUS_LABELS } from "@/components/transactions/work-order-forms";

export const metadata = { title: "Project" };

export default async function ProviderProjectPage({ params }: PageProps<"/provider/o/[orgId]/projects/[projectId]">) {
  const { orgId, projectId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const result = await getProject(ctx, projectId);
  if (!result.ok || result.value.organizationId !== orgId) notFound();
  const p = result.value;
  const [milestones, updates, changes, quotations, workOrders] = await Promise.all([
    listMilestones(ctx, projectId),
    listProjectUpdates(ctx, projectId),
    listChangeOrders(ctx, projectId),
    p.serviceRequestId ? listQuotations(ctx, p.serviceRequestId) : null,
    listWorkOrders(ctx, { organizationId: orgId, projectId }),
  ]);
  const canManage = access.permissions.has("projects.manage");
  const open = !["completed", "cancelled"].includes(p.status);
  const latest = quotations?.ok ? quotations.value[0] : undefined;

  return (
    <>
      <PageHeader
        title={p.title}
        eyebrow={PROJECT_KIND_LABELS[p.kind as keyof typeof PROJECT_KIND_LABELS] ?? "Project"}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Projects", href: `${base}/projects` },
          { label: p.title },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={p.status} contracted={!!p.contractQuotationId} />
      </div>
      <section aria-label="Project amounts" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Contract"
          value={p.contractAmountCentavos !== null ? formatPeso(p.contractAmountCentavos) : "—"}
        />
        <StatCard
          label="Approved changes"
          value={`${p.approvedChangesCentavos >= 0 ? "+" : "−"}${formatPeso(Math.abs(p.approvedChangesCentavos))}`}
        />
        <StatCard
          label="Current total"
          value={p.currentAmountCentavos !== null ? formatPeso(p.currentAmountCentavos) : "—"}
        />
        <StatCard label="Target finish" value={p.targetEndDate ? formatManilaDate(p.targetEndDate) : "—"} />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {canManage && open && (
            <SectionCard title="Next steps" id="actions">
              <ProjectStatusActions projectId={p.id} status={p.status} hasContract={!!p.contractQuotationId} />
              {!p.contractQuotationId && latest && p.serviceRequestId && (
                <Link
                  href={`${base}/quotations/${p.serviceRequestId}`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  {latest.status === "draft"
                    ? "Continue the quotation draft"
                    : `View quotation (version ${latest.version}, ${latest.status})`}
                </Link>
              )}
            </SectionCard>
          )}
          {p.contractQuotationId && (
            <SectionCard title="Change orders" id="changes">
              {changes.ok && changes.value.length ? (
                <ul className="flex flex-col divide-y divide-border">
                  {changes.value.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <p className="flex-1 text-sm font-medium">
                        #{c.number} {c.title}
                      </p>
                      <span className="text-sm font-semibold tabular-nums">{changeOrderAmount(c)}</span>
                      <StatusBadge
                        status={c.status}
                        tone={c.status === "proposed" ? "warning" : undefined}
                        label={c.status === "proposed" ? "Awaiting customer" : undefined}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No change orders. Any change in scope or price needs the customer&apos;s approval.
                </p>
              )}
              {canManage && open && <ProposeChangeOrderForm projectId={p.id} />}
            </SectionCard>
          )}
          <SectionCard title="Updates" id="updates">
            <div className="flex flex-col gap-4">
              {canManage && open && <PostUpdateForm projectId={p.id} showProgress />}
              <ProjectUpdates updates={updates.ok ? updates.value : []} />
            </div>
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          {canManage && open && (
            <SectionCard title="Schedule" id="schedule">
              <ProjectPlanForm
                projectId={p.id}
                status={p.status}
                siteVisitAt={toManilaLocal(p.siteVisitAt)}
                startDate={p.startDate ?? ""}
                targetEndDate={p.targetEndDate ?? ""}
              />
            </SectionCard>
          )}
          <SectionCard title="Milestones" id="milestones">
            <MilestoneList milestones={milestones.ok ? milestones.value : []} canManage={canManage && open} />
            {canManage && open && <AddMilestoneForm projectId={p.id} />}
          </SectionCard>
          <SectionCard title="Work orders" id="work-orders">
            {workOrders.ok && workOrders.value.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {workOrders.value.map((w) => (
                  <li key={w.id}>
                    <Link href={`${base}/work-orders/${w.id}`} className="font-medium hover:underline">
                      {w.title}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">· {WORK_ORDER_STATUS_LABELS[w.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No work orders.</p>
            )}
            {p.status === "active" && access.permissions.has("work_orders.manage") && (
              <Button asChild size="sm" variant="outline" className="w-fit">
                <Link href={`${base}/work-orders?source=${p.id}`}>Create work order</Link>
              </Button>
            )}
          </SectionCard>
          {p.status === "completed" && (
            <SectionCard title="Warranty" id="warranty">
              <p className="text-sm">
                {p.warrantyUntil ? `Until ${formatManilaDate(p.warrantyUntil)}` : "No warranty date."}
              </p>
              {p.warrantyTerms && <p className="text-sm text-muted-foreground">{p.warrantyTerms}</p>}
            </SectionCard>
          )}
          <SectionCard title="Scope" id="scope">
            <p className="text-sm whitespace-pre-line">{p.description || "—"}</p>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
