import { ScrollText } from "lucide-react";
import Link from "next/link";
import { listDisputes } from "@bahayplus/modules/admin";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { adminContext } from "@/components/admin/admin-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Disputes" };

export default async function AdminDisputesPage() {
  const { ctx } = await adminContext("platform.access");
  const disputes = await listDisputes(ctx);
  if (!disputes.ok) return <ErrorState description="We couldn't load disputes." />;
  const open = disputes.value.filter((d) => d.status === "open" || d.status === "under_review");
  const closed = disputes.value.filter((d) => !open.includes(d));
  const list = (items: typeof open) => (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/disputes/${d.id}`}
              className="inline-flex min-h-6 items-center font-medium hover:underline"
            >
              {d.bookingTitle || "Service booking"} · {d.providerName}
            </Link>
            <p className="text-xs text-muted-foreground">
              Opened {formatManilaDateTime(d.createdAt)}
              {d.reason ? ` · “${d.reason.slice(0, 80)}”` : ""}
            </p>
          </div>
          <StatusBadge
            status={d.status}
            tone={d.status === "open" ? "warning" : d.status === "under_review" ? "info" : undefined}
          />
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeader title="Disputes" description="Opened when a customer reports a problem with a completed job." />
      {disputes.value.length === 0 ? (
        <EmptyState icon={ScrollText} titleAs="h2" title="No disputes" description="Nothing to review." />
      ) : (
        <div className="flex flex-col gap-4">
          <SectionCard title={`Open (${open.length})`} id="open">
            {open.length ? list(open) : <p className="text-sm text-muted-foreground">None.</p>}
          </SectionCard>
          {closed.length > 0 && (
            <SectionCard title="Closed" id="closed">
              {list(closed)}
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
