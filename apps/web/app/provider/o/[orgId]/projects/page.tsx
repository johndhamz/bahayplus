import { Hammer } from "lucide-react";
import { notFound } from "next/navigation";
import { listProjects } from "@bahayplus/modules/projects";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { ProjectList } from "@/components/transactions/display";

export const metadata = { title: "Projects" };

export default async function ProviderProjectsPage({ params }: PageProps<"/provider/o/[orgId]/projects">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const projects = await listProjects(ctx, { organizationId: orgId });
  if (!projects.ok) return <ErrorState description="We couldn't load projects." />;
  const open = projects.value.filter((p) => !["completed", "cancelled"].includes(p.status));
  const closed = projects.value.filter((p) => !open.includes(p));
  return (
    <>
      <PageHeader title="Projects" breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Projects" }]} />
      {projects.value.length ? (
        <div className="flex flex-col gap-4">
          <SectionCard title={`Open (${open.length})`} id="open">
            {open.length ? (
              <ProjectList projects={open} hrefBase={`${base}/projects`} showProvider={false} />
            ) : (
              <p className="text-sm text-muted-foreground">No open projects.</p>
            )}
          </SectionCard>
          {closed.length > 0 && (
            <SectionCard title="Closed" id="closed">
              <ProjectList projects={closed} hrefBase={`${base}/projects`} showProvider={false} />
            </SectionCard>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Hammer}
          titleAs="h2"
          title="No projects yet"
          description="Project requests from customers appear here."
        />
      )}
    </>
  );
}
