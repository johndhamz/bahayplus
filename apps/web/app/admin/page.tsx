import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Admin overview" };

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Platform overview" description="Verification queue, organizations, users and audit trail." />
      <EmptyState
        icon={ShieldCheck}
        title="Platform administration"
        description="Admin tools are enabled for accounts granted platform-admin access on the server."
      />
    </>
  );
}
