import { notFound } from "next/navigation";
import { listOrgFiles } from "@bahayplus/modules/files";
import { listVerificationRequests, VERIFICATION_ITEM_LABELS } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { addMonthsClamped, formatManilaDate, formatManilaDateTime, manilaDateOf } from "@bahayplus/types/dates";
import { DecideForm, RevokeButton, StartReviewButton } from "@/components/marketplace/admin-verification-forms";
import { PageHeader } from "@/components/layout/page-header";
import { requirePlatformAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Verification request" };

export default async function VerificationRequestPage({ params }: PageProps<"/admin/verifications/[requestId]">) {
  const { requestId } = await params;
  const access = await requirePlatformAccess();
  if (!access.permissions.has("platform.verifications.decide")) notFound();
  const ctx = await requireServiceContext();
  const all = await listVerificationRequests(ctx, { limit: 500 });
  const request = all.ok ? all.value.find((r) => r.id === requestId) : undefined;
  if (!request) notFound();
  const [{ data: org }, files] = await Promise.all([
    ctx.db.from("organizations").select("name, slug").eq("id", request.organizationId).single(),
    listOrgFiles(
      ctx,
      "verification_item",
      request.items.map((i) => i.id),
    ),
  ]);
  return (
    <>
      <PageHeader
        title={org?.name ?? "Organization"}
        eyebrow={`Submitted ${formatManilaDateTime(request.submittedAt)}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Verifications", href: "/admin/verifications" },
          { label: org?.name ?? "Request" },
        ]}
        actions={
          request.status === "submitted" ? (
            <StartReviewButton requestId={request.id} />
          ) : request.status === "approved" ? (
            <RevokeButton requestId={request.id} />
          ) : undefined
        }
      />
      <StatusBadge status={request.status} className="mb-4" />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Documents" id="documents">
          <ul className="flex flex-col divide-y divide-border">
            {request.items.map((i) => {
              const docs = files.ok ? files.value.filter((f) => f.entityId === i.id) : [];
              return (
                <li key={i.id} className="flex flex-col gap-1 py-3">
                  <p className="font-medium">{VERIFICATION_ITEM_LABELS[i.itemType].label}</p>
                  <p className="text-xs text-muted-foreground">
                    {VERIFICATION_ITEM_LABELS[i.itemType].hint}
                    {i.referenceNumber ? ` · Ref ${i.referenceNumber}` : ""}
                    {i.validUntil ? ` · valid until ${formatManilaDate(i.validUntil)}` : ""}
                  </p>
                  {docs.length ? (
                    docs.map((d) => (
                      <a
                        key={d.id}
                        href={d.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        {d.fileName}
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-warning">No file uploaded</p>
                  )}
                  <StatusBadge
                    status={i.status}
                    className="w-fit"
                    tone={i.status === "verified" ? "success" : i.status === "rejected" ? "danger" : "neutral"}
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
        {request.status === "under_review" && (
          <SectionCard title="Decision" id="decision">
            <DecideForm
              requestId={request.id}
              items={request.items}
              defaultExpiry={addMonthsClamped(manilaDateOf(new Date()), 12)}
            />
          </SectionCard>
        )}
      </div>
    </>
  );
}
