import { notFound } from "next/navigation";
import { getServiceRequest, isQuotationOpen, listQuotations } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationSummary } from "@/components/transactions/display";
import { QuotationDecision } from "@/components/transactions/quotation-forms";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Quote request" };

export default async function QuoteRequestPage({
  params,
}: PageProps<"/app/h/[householdId]/bookings/requests/[requestId]">) {
  const { householdId, requestId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("services.view")) notFound();
  const ctx = await requireServiceContext();
  const request = await getServiceRequest(ctx, requestId);
  if (!request.ok || request.value.householdId !== householdId) notFound();
  const r = request.value;
  const quotations = await listQuotations(ctx, requestId);
  // Drafts are the provider's work in progress; customers see only what was sent.
  const visible = (quotations.ok ? quotations.value : []).filter((q) => q.status !== "draft");
  const today = manilaDateOf(new Date());
  const canDecide = access.permissions.has("services.book");
  const base = `/app/h/${householdId}`;

  return (
    <>
      <PageHeader
        title={r.title}
        eyebrow={`Quote request · ${r.providerName}`}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Bookings", href: `${base}/bookings` },
          { label: "Quote request" },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <span className="text-xs text-muted-foreground">Requested {formatManilaDate(new Date(r.createdAt))}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {visible.length ? (
            visible.map((q) => {
              const open = isQuotationOpen(q, today);
              return (
                <SectionCard key={q.id} title={`Quotation from ${r.providerName}`} id={`q-${q.version}`}>
                  <QuotationSummary quotation={q} expired={q.status === "sent" && !open} />
                  {canDecide && open && (
                    <div className="mt-4">
                      <QuotationDecision quotationId={q.id} total={q.totalCentavos} />
                    </div>
                  )}
                </SectionCard>
              );
            })
          ) : (
            <SectionCard title="Waiting for a quotation" id="waiting">
              <p className="text-sm text-muted-foreground">
                {r.providerName} hasn&apos;t sent a quotation yet. You&apos;ll be notified when they do.
              </p>
            </SectionCard>
          )}
        </div>
        <SectionCard title="Your request" id="request">
          <dl className="flex flex-col gap-2 text-sm">
            {r.preferredDate && (
              <div>
                <dt className="text-muted-foreground">Preferred date</dt>
                <dd>{formatManilaDate(r.preferredDate)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Details</dt>
              <dd className="whitespace-pre-line">{r.description || "—"}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </>
  );
}
