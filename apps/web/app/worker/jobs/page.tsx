import { HardHat } from "lucide-react";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { JobList } from "@/components/worker/job-list";
import { myJobs } from "@/components/worker/worker-data";

export const metadata = { title: "Jobs" };

export default async function WorkerJobsPage() {
  const { jobs, orgName } = await myJobs();
  if (!jobs) return <ErrorState description="We couldn't load your jobs." />;
  const open = jobs.filter((j) => !["completed", "cancelled"].includes(j.status));
  const done = jobs
    .filter((j) => j.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return (
    <>
      <PageHeader title="Jobs" description="Everything assigned to you." />
      {jobs.length === 0 ? (
        <EmptyState icon={HardHat} titleAs="h2" title="No jobs yet" description="Assigned jobs will be listed here." />
      ) : (
        <div className="flex flex-col gap-4">
          <SectionCard title={`Upcoming & in progress (${open.length})`} id="open">
            {open.length ? (
              <JobList jobs={open} orgName={orgName} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing open.</p>
            )}
          </SectionCard>
          {done.length > 0 && (
            <SectionCard title={`Completed (${done.length})`} id="done">
              <JobList jobs={done.slice(0, 30)} orgName={orgName} />
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
