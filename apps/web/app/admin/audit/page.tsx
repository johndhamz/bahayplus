import Link from "next/link";
import { AUDIT_PAGE_SIZE, listAuditLog } from "@bahayplus/modules/admin";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { AuditQuery } from "@bahayplus/validation/admin/admin";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { adminContext } from "@/components/admin/admin-guard";
import { selectClassName } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Audit log" };

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const q = AuditQuery.parse(await searchParams);
  const { ctx } = await adminContext("platform.audit.view");
  const rows = await listAuditLog(ctx, q);
  const qs = (page: number) =>
    `/admin/audit?${new URLSearchParams(Object.entries({ action: q.action, from: q.from, to: q.to, page: String(page) }).filter(([, v]) => v) as [string, string][]).toString()}`;
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of sensitive actions. Times in Philippine time." />
      <form
        method="get"
        className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-4 sm:items-end"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Action starts with
          <input name="action" defaultValue={q.action} placeholder="e.g. platform." className={selectClassName} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <input type="date" name="from" defaultValue={q.from} className={selectClassName} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <input type="date" name="to" defaultValue={q.to} className={selectClassName} />
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      {!rows.ok ? (
        <ErrorState description="We couldn't load the audit log." />
      ) : (
        <SectionCard title="Entries" id="entries">
          <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Scrollable table">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Audit log entries</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th scope="col" className="pb-2 font-semibold">
                    When
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Actor
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Action
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Target
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {rows.value.slice(0, AUDIT_PAGE_SIZE).map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-2 whitespace-nowrap">{formatManilaDateTime(a.occurredAt)}</td>
                    <td className="py-2 pr-2">{a.actorType === "system" ? "System" : a.actorName || "User"}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{a.action}</td>
                    <td className="py-2 pr-2 text-xs">
                      {a.targetType}
                      {a.targetId ? ` ${a.targetId.slice(0, 8)}` : ""}
                    </td>
                    <td className="max-w-xs py-2 text-xs break-words text-muted-foreground">
                      {Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Pagination" className="flex gap-2">
            {q.page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={qs(q.page - 1)}>Newer</Link>
              </Button>
            )}
            {rows.value.length > AUDIT_PAGE_SIZE && (
              <Button asChild variant="outline" size="sm">
                <Link href={qs(q.page + 1)}>Older</Link>
              </Button>
            )}
          </nav>
        </SectionCard>
      )}
    </>
  );
}
