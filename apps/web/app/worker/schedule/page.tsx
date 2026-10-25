import { CalendarDays } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { addDays, manilaDateOf, manilaWallTimeToUtc } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { JobList } from "@/components/worker/job-list";
import { manilaDay, myJobs } from "@/components/worker/worker-data";

export const metadata = { title: "Schedule" };

const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

export default async function WorkerSchedulePage() {
  const today = manilaDateOf(new Date());
  const { jobs, orgName } = await myJobs({
    from: manilaWallTimeToUtc(today).toISOString(),
    to: manilaWallTimeToUtc(addDays(today, 14)).toISOString(),
  });
  if (!jobs) return <ErrorState description="We couldn't load your schedule." />;
  const upcoming = jobs.filter((j) => j.status !== "cancelled");
  const days = [...new Set(upcoming.map((j) => manilaDay(j.scheduledStart)))].sort();
  return (
    <>
      <PageHeader title="Schedule" description="Your next 14 days (Philippine time)." />
      {days.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          titleAs="h2"
          title="Nothing scheduled"
          description="No jobs in the next two weeks."
        />
      ) : (
        <ol className="flex flex-col gap-5">
          {days.map((d) => (
            <li key={d}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {d === today ? "Today" : dayLabel(d)}
              </h2>
              <JobList jobs={upcoming.filter((j) => manilaDay(j.scheduledStart) === d)} orgName={orgName} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
