import { notFound } from "next/navigation";
import { isQuotationOpen, listQuotations } from "@bahayplus/modules/bookings";
import { getProject, listChangeOrders, listMilestones, listProjectUpdates } from "@bahayplus/modules/projects";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, formatManilaDateTime, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import {
  changeOrderAmount,
  ProjectStatusBadge,
  ProjectUpdates,
  QuotationSummary,
} from "@/components/transactions/display";
import {
  ChangeOrderDecision,
  MilestoneList,
  PostUpdateForm,
  PROJECT_KIND_LABELS,
} from "@/components/transactions/project-forms";
import { QuotationDecision } from "@/components/transactions/quotation-forms";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/app/h/[householdId]/projects/[projectId]">) {
  const { householdId, projectId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("services.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getProject(ctx, projectId);
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const p = result.value;
  const [milestones, updates, changes, quotations] = await Promise.all([
    listMilestones(ctx, projectId),
    listProjectUpdates(ctx, projectId),
    listChangeOrders(ctx, projectId),
    p.serviceRequestId ? listQuotations(ctx, p.serviceRequestId) : null,
  ]);
  const canAct = access.permissions.has("services.book");
  const today = manilaDateOf(new Date());
  const sentQuotes = (quotations?.ok ? quotations.value : []).filter((q) => q.status !== "draft");
  const base = `/app/h/${householdId}`;

  return (
    <>
      <PageHeader
        title={p.title}
        eyebrow={`${PROJECT_KIND_LABELS[p.kind as keyof typeof PROJECT_KIND_LABELS] ?? "Project"} · ${p.providerName}`}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Projects", href: `${base}/projects` },
          { label: p.title },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={p.status} contracted={!!p.contractQuotationId} />
        {p.siteVisitAt && p.status === "site_visit_scheduled" && (
          <span className="text-sm">Site visit {formatManilaDateTime(p.siteVisitAt)}</span>
        )}
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
          {!p.contractQuotationId && (
            <SectionCard title="Quotation" id="quotation">
              {sentQuotes.length ? (
                <div className="flex flex-col gap-6">
                  {sentQuotes.map((q) => {
                    const open = isQuotationOpen(q, today);
                    return (
                      <div key={q.id}>
                        <QuotationSummary quotation={q} expired={q.status === "sent" && !open} />
                        {canAct && open && (
                          <div className="mt-3">
                            <QuotationDecision quotationId={q.id} total={q.totalCentavos} projectId={p.id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {p.providerName} will send a quotation after reviewing your project
                  {p.siteVisitAt ? " and visiting the site" : ""}.
                </p>
              )}
            </SectionCard>
          )}
          {changes.ok && changes.value.length > 0 && (
            <SectionCard title="Change orders" id="changes">
              <ul className="flex flex-col divide-y divide-border">
                {changes.value.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex-1 text-sm font-medium">
                        #{c.number} {c.title}
                      </p>
                      <span className="text-sm font-semibold tabular-nums">{changeOrderAmount(c)}</span>
                      <StatusBadge
                        status={c.status}
                        tone={c.status === "proposed" ? "warning" : undefined}
                        label={c.status === "proposed" ? "Needs your approval" : undefined}
                      />
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                    {c.scheduleDeltaDays !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        Schedule {c.scheduleDeltaDays > 0 ? "+" : ""}
                        {c.scheduleDeltaDays} days
                      </p>
                    )}
                    {canAct && c.status === "proposed" && (
                      <ChangeOrderDecision
                        changeOrderId={c.id}
                        title={c.title}
                        amountDeltaCentavos={c.amountDeltaCentavos}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          <SectionCard title="Updates" id="updates">
            <div className="flex flex-col gap-4">
              {canAct && !["completed", "cancelled"].includes(p.status) && (
                <PostUpdateForm projectId={p.id} showProgress={false} />
              )}
              <ProjectUpdates updates={updates.ok ? updates.value : []} />
            </div>
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="Milestones" id="milestones">
            <MilestoneList milestones={milestones.ok ? milestones.value : []} canManage={false} />
          </SectionCard>
          {p.status === "completed" && (
            <SectionCard title="Warranty" id="warranty">
              <p className="text-sm">
                {p.warrantyUntil ? `Covered until ${formatManilaDate(p.warrantyUntil)}` : "No warranty date recorded."}
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
