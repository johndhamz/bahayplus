import { Hammer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProviderBySlug } from "@bahayplus/modules/marketplace";
import { listProjects } from "@bahayplus/modules/projects";
import { listProperties } from "@bahayplus/modules/properties";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectList } from "@/components/transactions/display";
import { NewProjectForm } from "@/components/transactions/project-forms";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ params, searchParams }: PageProps<"/app/h/[householdId]/projects">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("services.view")) notFound();
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const slug = typeof sp.provider === "string" ? sp.provider : null;

  if (slug && access.permissions.has("services.book")) {
    const provider = await getProviderBySlug(ctx, slug);
    if (!provider.ok) notFound();
    const properties = await listProperties(ctx, householdId);
    const props = properties.ok ? properties.value.map((p) => ({ id: p.id, name: p.name })) : [];
    return (
      <>
        <PageHeader
          title="Start a project"
          breadcrumbs={[
            { label: "Home", href: base },
            { label: "Projects", href: `${base}/projects` },
            { label: "New" },
          ]}
        />
        <SectionCard title={provider.value.name} id="new" className="max-w-2xl">
          {props.length ? (
            <NewProjectForm
              householdId={householdId}
              organizationId={provider.value.organizationId}
              providerName={provider.value.name}
              properties={props}
              defaultPropertyId={null}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href={`${base}/properties`} className="font-medium text-brand hover:underline">
                Add a property
              </Link>{" "}
              first so the provider knows where the project is.
            </p>
          )}
        </SectionCard>
      </>
    );
  }

  const projects = await listProjects(ctx, { householdId });
  if (!projects.ok) return <ErrorState description="We couldn't load your projects." />;
  return (
    <>
      <PageHeader
        title="Projects"
        description="Renovations, custom furniture and other multi-day work."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Projects" }]}
        actions={
          <Button asChild>
            <Link href={`${base}/services?division=renovation`}>Find a contractor</Link>
          </Button>
        }
      />
      {projects.value.length ? (
        <SectionCard title="Your projects" id="projects">
          <ProjectList projects={projects.value} hrefBase={`${base}/projects`} showProvider />
        </SectionCard>
      ) : (
        <EmptyState
          icon={Hammer}
          titleAs="h2"
          title="No projects yet"
          description="Start a project from a contractor's profile. They'll visit, quote and keep you updated here."
        />
      )}
    </>
  );
}
