import { BadgeCheck } from "lucide-react";
import { listOrgFiles } from "@bahayplus/modules/files";
import { listVerificationRequests, VERIFICATION_ITEM_LABELS } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { OrgFileUpload, SubmitVerificationForm } from "@/components/marketplace/provider-forms";
import { providerContext, requireManage } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Verification" };

const STATUS_TEXT: Record<string, string> = {
  submitted: "Submitted — waiting for review",
  under_review: "Under review by Bahay+",
  approved: "Approved",
  rejected: "Not approved",
  expired: "Expired",
  revoked: "Revoked",
};

export default async function VerificationPage({ params }: PageProps<"/provider/o/[orgId]/verification">) {
  const { orgId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  requireManage(canManage);
  const requests = await listVerificationRequests(ctx, { organizationId: orgId });
  const all = requests.ok ? requests.value : [];
  const open = all.find((r) => r.status === "submitted" || r.status === "under_review");
  const files = await listOrgFiles(
    ctx,
    "verification_item",
    all.flatMap((r) => r.items.map((i) => i.id)),
  );
  return (
    <>
      <PageHeader
        title="Verification"
        description="Verified businesses are listed in the marketplace with a badge that names exactly what Bahay+ checked."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Verification" }]}
      />
      <div className="flex max-w-4xl flex-col gap-4">
        {!open && (
          <SectionCard title={all.length ? "Submit a new verification" : "Start verification"} id="submit">
            <SubmitVerificationForm organizationId={orgId} />
          </SectionCard>
        )}
        {all.map((r) => (
          <SectionCard
            key={r.id}
            title={STATUS_TEXT[r.status] ?? r.status}
            id={`r-${r.id}`}
            headerExtra={<StatusBadge status={r.status} />}
          >
            <p className="text-xs text-muted-foreground">
              Submitted {formatManilaDateTime(r.submittedAt)}
              {r.expiresOn && r.status === "approved" ? ` · valid until ${formatManilaDate(r.expiresOn)}` : ""}
            </p>
            {r.decisionNotes && <p className="rounded-lg bg-muted p-3 text-sm">{r.decisionNotes}</p>}
            {r.revokedReason && (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-destructive">Revoked: {r.revokedReason}</p>
            )}
            <ul className="flex flex-col divide-y divide-border">
              {r.items.map((item) => {
                const docs = files.ok ? files.value.filter((f) => f.entityId === item.id) : [];
                return (
                  <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {item.status === "verified" && (
                          <BadgeCheck aria-hidden="true" className="size-4 text-success" />
                        )}
                        {VERIFICATION_ITEM_LABELS[item.itemType].label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {VERIFICATION_ITEM_LABELS[item.itemType].hint}
                        {item.referenceNumber ? ` · Ref ${item.referenceNumber}` : ""}
                        {item.reviewerNote ? ` · ${item.reviewerNote}` : ""}
                      </p>
                      <p className="text-xs">
                        {docs.length
                          ? `${docs.length} file${docs.length === 1 ? "" : "s"} uploaded`
                          : "No file uploaded yet"}
                      </p>
                    </div>
                    <StatusBadge
                      status={item.status}
                      tone={item.status === "verified" ? "success" : item.status === "rejected" ? "danger" : "neutral"}
                    />
                    {(r.status === "submitted" || r.status === "under_review") && (
                      <OrgFileUpload
                        organizationId={orgId}
                        entityType="verification_item"
                        entityId={item.id}
                        label="Upload document"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
