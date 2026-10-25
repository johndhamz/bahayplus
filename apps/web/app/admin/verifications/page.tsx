import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { listVerificationRequests } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { requirePlatformAccess, requireServiceContext } from "@/lib/auth/context";
import { notFound } from "next/navigation";

export const metadata = { title: "Verification queue" };

export default async function VerificationQueuePage() {
  const access = await requirePlatformAccess();
  if (!access.permissions.has("platform.verifications.decide")) notFound();
  const ctx = await requireServiceContext();
  const [queue, approved] = await Promise.all([
    listVerificationRequests(ctx, { statuses: ["submitted", "under_review"], limit: 100 }),
    listVerificationRequests(ctx, { statuses: ["approved"], limit: 50 }),
  ]);
  const orgIds = [
    ...new Set([...(queue.ok ? queue.value : []), ...(approved.ok ? approved.value : [])].map((r) => r.organizationId)),
  ];
  const { data: orgs } = orgIds.length
    ? await ctx.db.from("organizations").select("id, name").in("id", orgIds)
    : { data: [] };
  const name = (id: string) => orgs?.find((o) => o.id === id)?.name ?? "Organization";
  const row = (r: { id: string; organizationId: string; status: string; submittedAt: string; items: unknown[] }) => (
    <li key={r.id}>
      <Link
        href={`/admin/verifications/${r.id}`}
        className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/60"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{name(r.organizationId)}</p>
          <p className="text-xs text-muted-foreground">
            {r.items.length} document{r.items.length === 1 ? "" : "s"} · submitted {formatManilaDateTime(r.submittedAt)}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </Link>
    </li>
  );
  return (
    <>
      <PageHeader
        title="Verification queue"
        description="Oldest first. Every decision is audited."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Verifications" }]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Waiting for review" id="queue">
          {queue.ok && queue.value.length ? (
            <ul className="divide-y divide-border">{queue.value.map(row)}</ul>
          ) : (
            <EmptyState size="compact" icon={BadgeCheck} title="Queue is empty" />
          )}
        </SectionCard>
        <SectionCard title="Currently approved" id="approved">
          {approved.ok && approved.value.length ? (
            <ul className="divide-y divide-border">{approved.value.map(row)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
