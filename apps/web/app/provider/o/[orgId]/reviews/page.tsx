import { Star } from "lucide-react";
import { listProviderReviews } from "@bahayplus/modules/marketplace";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { formatManilaDate } from "@bahayplus/types/dates";
import { ReplyForm } from "@/components/marketplace/provider-forms";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Reviews" };

export default async function ProviderReviewsPage({ params }: PageProps<"/provider/o/[orgId]/reviews">) {
  const { orgId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  const reviews = await listProviderReviews(ctx, orgId, 50);
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Reviews come only from customers whose booking with you was completed."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Reviews" }]}
      />
      {reviews.ok && reviews.value.length ? (
        <div className="flex max-w-3xl flex-col gap-3">
          {reviews.value.map((r) => (
            <SectionCard key={r.id} title={`Rated ${r.rating} out of 5`} id={`rv-${r.id}`}>
              <p aria-hidden="true" className="text-gold">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </p>
              <p className="text-xs text-muted-foreground">{formatManilaDate(new Date(r.createdAt))}</p>
              {r.comment && <p className="text-sm">{r.comment}</p>}
              {r.providerReply && !canManage && (
                <p className="rounded-lg bg-muted p-3 text-sm">Your reply: {r.providerReply}</p>
              )}
              {canManage && <ReplyForm reviewId={r.id} existing={r.providerReply} />}
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description="Customers can review you after a completed booking."
        />
      )}
    </>
  );
}
