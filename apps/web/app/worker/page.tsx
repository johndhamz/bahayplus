import { HardHat } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Today" };

export default function WorkerTodayPage() {
  return (
    <>
      <PageHeader title="Today's jobs" description="Jobs assigned to you by your service provider." />
      <EmptyState
        icon={HardHat}
        title="No jobs assigned"
        description="When a dispatcher assigns you a job, it will show up here with the address, checklist and schedule."
      />
    </>
  );
}
