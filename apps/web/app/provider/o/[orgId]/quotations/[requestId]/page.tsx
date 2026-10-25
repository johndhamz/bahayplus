import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceRequest, isQuotationOpen, listQuotations } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { addDays, formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { QuotationSummary } from "@/components/transactions/display";
import {
  NewQuotationVersionButton,
  QuotationDraftEditor,
  WithdrawQuotationButton,
} from "@/components/transactions/quotation-forms";

export const metadata = { title: "Quote request" };

export default async function ProviderQuoteRequestPage({
  params,
}: PageProps<"/provider/o/[orgId]/quotations/[requestId]">) {
  const { orgId, requestId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const request = await getServiceRequest(ctx, requestId);
  if (!request.ok || request.value.organizationId !== orgId) notFound();
  const r = request.value;
  const quotations = await listQuotations(ctx, requestId);
  const all = quotations.ok ? quotations.value : [];
  const draft = all.find((q) => q.status === "draft");
  const canManage = access.permissions.has("bookings.manage");
  const today = manilaDateOf(new Date());
  const isOpen = r.status === "open" || r.status === "quoted";

  return (
    <>
      <PageHeader
        title={r.title}
        eyebrow="Quote request"
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Quotations", href: `${base}/quotations` },
          { label: r.title },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <span className="text-xs text-muted-foreground">Requested {formatManilaDate(new Date(r.createdAt))}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {canManage && draft && (
            <SectionCard
              title={`Draft — version ${draft.version}`}
              id="draft"
              headerExtra={<WithdrawQuotationButton quotationId={draft.id} isDraft />}
            >
              <QuotationDraftEditor draft={draft} defaultValidUntil={addDays(today, 14)} />
            </SectionCard>
          )}
          {canManage && !draft && isOpen && (
            <SectionCard title={all.length ? "Revise your quotation" : "Prepare a quotation"} id="new">
              <p className="mb-3 text-sm text-muted-foreground">
                {all.length
                  ? "A new version replaces the one you sent. The customer sees every version."
                  : "List materials and labor. Totals are calculated for you in pesos."}
              </p>
              <NewQuotationVersionButton
                requestId={r.id}
                label={all.length ? "Create new version" : "Create quotation"}
              />
            </SectionCard>
          )}
          {all
            .filter((q) => q.status !== "draft")
            .map((q) => (
              <SectionCard
                key={q.id}
                title={`Sent ${q.sentAt ? formatManilaDate(new Date(q.sentAt)) : ""}`}
                id={`q-${q.version}`}
                headerExtra={
                  canManage && q.status === "sent" ? (
                    <WithdrawQuotationButton quotationId={q.id} isDraft={false} />
                  ) : undefined
                }
              >
                <QuotationSummary quotation={q} expired={q.status === "sent" && !isQuotationOpen(q, today)} />
              </SectionCard>
            ))}
        </div>
        <SectionCard title="Customer request" id="request">
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
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-muted-foreground">The exact address is shared once a booking is confirmed.</dd>
            </div>
          </dl>
          {r.status === "accepted" && (
            <Link
              href={`${base}/bookings`}
              className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
            >
              Go to bookings
            </Link>
          )}
        </SectionCard>
      </div>
    </>
  );
}
