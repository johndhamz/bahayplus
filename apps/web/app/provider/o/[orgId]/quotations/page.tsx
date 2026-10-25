import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listServiceRequests } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";

export const metadata = { title: "Quotations" };

const STATUS_LABEL = {
  open: "Needs quote",
  quoted: "Quote sent",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
} as const;

export default async function ProviderQuotationsPage({ params }: PageProps<"/provider/o/[orgId]/quotations">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const requests = await listServiceRequests(ctx, { organizationId: orgId });
  if (!requests.ok) return <ErrorState description="We couldn't load quote requests." />;
  const open = requests.value.filter((r) => r.status === "open" || r.status === "quoted");
  const closed = requests.value.filter((r) => !open.includes(r));
  const list = (items: typeof open) => (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`${base}/quotations/${r.id}`} className="font-medium hover:underline">
              {r.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              Requested {formatManilaDate(new Date(r.createdAt))}
              {r.preferredDate ? ` · preferred ${formatManilaDate(r.preferredDate)}` : ""}
            </p>
          </div>
          <StatusBadge
            status={r.status}
            tone={r.status === "open" ? "warning" : undefined}
            label={STATUS_LABEL[r.status]}
          />
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Quote requests from customers."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Quotations" }]}
      />
      {requests.value.length ? (
        <div className="flex flex-col gap-4">
          <SectionCard title={`Open (${open.length})`} id="open">
            {open.length ? list(open) : <p className="text-sm text-muted-foreground">No open requests.</p>}
          </SectionCard>
          {closed.length > 0 && (
            <SectionCard title="Closed" id="closed">
              {list(closed)}
            </SectionCard>
          )}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          titleAs="h2"
          title="No quote requests yet"
          description="When customers request a quote, it appears here."
        />
      )}
    </>
  );
}
