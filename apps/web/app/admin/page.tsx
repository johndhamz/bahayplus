import { AlertTriangle, BadgeCheck, Building2, MailWarning, ScrollText, Users } from "lucide-react";
import { getAdminOverview } from "@bahayplus/modules/admin";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { adminContext } from "@/components/admin/admin-guard";

export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const { access, ctx } = await adminContext("platform.access");
  const overview = await getAdminOverview(ctx);
  if (!overview.ok) return <ErrorState description="We couldn't load the overview." />;
  const o = overview.value;
  return (
    <>
      <PageHeader
        title="Platform overview"
        description={`Signed in with the ${access.role.replace("_", " ")} role. Every privileged action is recorded in the audit log.`}
      />
      <section aria-label="Platform summary" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard
          label="Verifications waiting"
          value={o.pendingVerifications}
          icon={BadgeCheck}
          href="/admin/verifications"
          tone={o.pendingVerifications ? "terracotta" : "default"}
        />
        <StatCard
          label="Open disputes"
          value={o.openDisputes}
          icon={ScrollText}
          href="/admin/disputes"
          tone={o.openDisputes ? "terracotta" : "default"}
        />
        <StatCard label="Organizations" value={o.organizations} icon={Building2} href="/admin/organizations" />
        <StatCard
          label="Suspended organizations"
          value={o.suspendedOrganizations}
          icon={AlertTriangle}
          href="/admin/organizations?status=suspended"
        />
        <StatCard label="Users" value={o.users} icon={Users} href="/admin/users" />
        <StatCard label="Failed notifications (7 days)" value={o.failedDeliveries7d} icon={MailWarning} />
      </section>
    </>
  );
}
