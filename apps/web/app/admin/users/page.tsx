import { listUsersForAdmin } from "@bahayplus/modules/admin";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { UserSuspensionAction } from "@/components/admin/admin-forms";
import { adminContext } from "@/components/admin/admin-guard";
import { selectClassName } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const { ctx, can } = await adminContext("platform.users.view");
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const users = await listUsersForAdmin(ctx, { search: q || undefined });
  const canManage = can("platform.users.manage");
  return (
    <>
      <PageHeader
        title="Users"
        description={
          canManage
            ? "Account status only. Admins cannot see the contents of households or businesses."
            : "Read-only directory. Email addresses are masked for your role; search by name."
        }
      />
      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Search {canManage ? "name or email" : "name"}
          <input name="q" defaultValue={q} className={selectClassName} />
        </label>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {!users.ok ? (
        <ErrorState description="We couldn't load users." />
      ) : (
        <SectionCard title={`${users.value.length} user(s)`} id="users">
          <ul className="flex flex-col divide-y divide-border">
            {users.value.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{u.fullName || "No name"}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · joined {formatManilaDate(new Date(u.createdAt))}
                    {u.lastSignInAt ? ` · last sign-in ${formatManilaDateTime(u.lastSignInAt)}` : " · never signed in"}
                    {` · ${u.householdCount} household(s), ${u.organizationCount} business(es)`}
                  </p>
                </div>
                {u.platformRole && <StatusBadge status="admin" tone="brand" label={u.platformRole.replace("_", " ")} />}
                {u.suspended && <StatusBadge status="suspended" />}
                {canManage && (
                  <UserSuspensionAction userId={u.id} name={u.fullName || "this user"} suspended={u.suspended} />
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
