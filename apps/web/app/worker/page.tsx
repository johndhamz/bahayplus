import { HardHat } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { JobList } from "@/components/worker/job-list";
import { manilaDay, myJobs } from "@/components/worker/worker-data";

export const metadata = { title: "Today" };

export default async function WorkerTodayPage() {
  const { jobs, orgName } = await myJobs();
  const today = manilaDateOf(new Date());
  if (!jobs) return <ErrorState description="We couldn't load your jobs." />;
  const todays = jobs.filter((j) => manilaDay(j.scheduledStart) === today && j.status !== "cancelled");
  const active = jobs.filter((j) => j.status === "en_route" || j.status === "in_progress");
  const list = [...new Map([...active, ...todays].map((j) => [j.id, j])).values()];
  return (
    <>
      <PageHeader title="Today's jobs" description={formatManilaDate(today)} />
      {list.length ? (
        <JobList jobs={list} orgName={orgName} />
      ) : (
        <EmptyState
          icon={HardHat}
          titleAs="h2"
          title="No jobs today"
          description="When a dispatcher assigns you a job, it shows up here with the address, checklist and schedule."
        />
      )}
    </>
  );
}
