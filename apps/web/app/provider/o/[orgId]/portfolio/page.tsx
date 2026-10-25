import { listOrgFiles } from "@bahayplus/modules/files";
import { listPortfolio } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { manilaDateOf, formatManilaDate } from "@bahayplus/types/dates";
import { DeleteButton, OrgFileUpload, PortfolioItemForm } from "@/components/marketplace/provider-forms";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";
import { deletePortfolioItemAction } from "@/lib/actions/marketplace";

export const metadata = { title: "Portfolio" };

export default async function PortfolioPage({ params }: PageProps<"/provider/o/[orgId]/portfolio">) {
  const { orgId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  const items = await listPortfolio(ctx, orgId);
  const photos = items.ok
    ? await listOrgFiles(
        ctx,
        "portfolio",
        items.value.map((i) => i.id),
      )
    : null;
  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Photos of past work are public on your marketplace profile."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Portfolio" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {items.ok && items.value.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
          {items.ok &&
            items.value.map((item) => {
              const images = photos?.ok ? photos.value.filter((f) => f.entityId === item.id) : [];
              return (
                <SectionCard
                  key={item.id}
                  title={item.title}
                  id={`p-${item.id}`}
                  headerExtra={
                    canManage ? (
                      <DeleteButton
                        label={item.title}
                        action={deletePortfolioItemAction.bind(null, { itemId: item.id })}
                      />
                    ) : undefined
                  }
                >
                  {item.completedOn && (
                    <p className="text-xs text-muted-foreground">Completed {formatManilaDate(item.completedOn)}</p>
                  )}
                  {item.description && <p className="text-sm">{item.description}</p>}
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {images.map((img) => (
                      <li key={img.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- public portfolio bucket */}
                        <img
                          src={img.url ?? ""}
                          alt={`${item.title} photo`}
                          className="aspect-square w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      </li>
                    ))}
                  </ul>
                  {canManage && (
                    <OrgFileUpload
                      organizationId={orgId}
                      entityType="portfolio"
                      entityId={item.id}
                      label="Add photo"
                      imagesOnly
                    />
                  )}
                </SectionCard>
              );
            })}
        </div>
        {canManage && (
          <SectionCard title="Add a project" id="add-project">
            <PortfolioItemForm organizationId={orgId} today={manilaDateOf(new Date())} />
          </SectionCard>
        )}
      </div>
    </>
  );
}
