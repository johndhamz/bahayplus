import { supplierReport } from "@bahayplus/modules/suppliers";
import { ColumnChart } from "@bahayplus/ui/components/data/column-chart";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";

export const metadata = { title: "Reports" };

const monthName = (iso: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("en-PH", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export default async function SupplierReportsPage({ params }: PageProps<"/supplier/o/[orgId]/reports">) {
  const { orgId } = await params;
  const { ctx, base } = await supplierContext(orgId, "finance.view");
  const report = await supplierReport(ctx, orgId, 6);
  if (!report.ok) return <ErrorState description="We couldn't load reports." />;
  const { months, topProducts } = report.value;
  return (
    <>
      <PageHeader
        title="Reports"
        description="Delivered order revenue (recorded; payments are arranged outside Bahay+)."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Reports" }]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Delivered revenue" id="revenue">
          <ColumnChart
            title="Delivered order revenue, last 6 months"
            valueFormat="peso"
            data={months.map((m) => ({
              key: m.month,
              label: monthName(m.month, "short"),
              value: m.revenueCentavos,
              display: formatPeso(m.revenueCentavos),
            }))}
          />
        </SectionCard>
        <SectionCard title="Orders by month" id="orders">
          <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Scrollable table">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Orders by month</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th scope="col" className="pb-2 font-semibold">
                    Month
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Received
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Delivered
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Cancelled / rejected
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...months].reverse().map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className="py-2 text-left font-medium">
                      {monthName(m.month)}
                    </th>
                    <td className="py-2 text-right tabular-nums">{m.ordersReceived}</td>
                    <td className="py-2 text-right tabular-nums">{m.ordersDelivered}</td>
                    <td className="py-2 text-right tabular-nums">{m.ordersCancelled}</td>
                    <td className="py-2 text-right tabular-nums">{formatPeso(m.revenueCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="Top products (delivered)" id="top">
          {topProducts.length ? (
            <ol className="flex flex-col gap-1 text-sm">
              {topProducts.map((t) => (
                <li key={t.productId} className="flex justify-between gap-2">
                  <span>{t.productName}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t.quantity} · {formatPeso(t.revenueCentavos)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No delivered orders yet.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
