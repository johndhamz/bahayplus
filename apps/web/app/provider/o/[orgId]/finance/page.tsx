import { notFound } from "next/navigation";
import { getFinancialSummary } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { ColumnChart } from "@bahayplus/ui/components/data/column-chart";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";

export const metadata = { title: "Financial summary" };

const monthName = (iso: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("en-PH", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export default async function FinancePage({ params }: PageProps<"/provider/o/[orgId]/finance">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("finance.view")) notFound();
  const summary = await getFinancialSummary(ctx, orgId, 6);
  if (!summary.ok) return <ErrorState description="We couldn't load your financial summary." />;
  const months = summary.value;
  const current = months.at(-1)!;
  const total = (k: "jobValueCentavos" | "projectValueCentavos" | "purchasesCentavos") =>
    months.reduce((s, m) => s + m[k], 0);
  return (
    <>
      <PageHeader
        title="Financial summary"
        description="Recorded values from completed jobs, completed projects and delivered purchases. Bahay+ does not process payments."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Financial summary" }]}
      />
      <section aria-label="This month" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Jobs completed this month" value={current.completedJobs} />
        <StatCard label="Job value this month" value={formatPeso(current.jobValueCentavos)} />
        <StatCard label="Projects value (6 months)" value={formatPeso(total("projectValueCentavos"))} />
        <StatCard label="Purchases (6 months)" value={formatPeso(total("purchasesCentavos"))} tone="terracotta" />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Completed job value" id="trend">
          <ColumnChart
            title="Completed job value, last 6 months"
            valueFormat="peso"
            data={months.map((m) => ({
              key: m.month,
              label: monthName(m.month, "short"),
              value: m.jobValueCentavos + m.projectValueCentavos,
              display: formatPeso(m.jobValueCentavos + m.projectValueCentavos),
            }))}
          />
        </SectionCard>
        <SectionCard title="By month" id="table">
          <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Scrollable table">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">Monthly financial summary</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th scope="col" className="pb-2 font-semibold">
                    Month
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Jobs
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Job value
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Projects
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Purchases
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...months].reverse().map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className="py-2 text-left font-medium">
                      {monthName(m.month)}
                    </th>
                    <td className="py-2 text-right tabular-nums">{m.completedJobs}</td>
                    <td className="py-2 text-right tabular-nums">{formatPeso(m.jobValueCentavos)}</td>
                    <td className="py-2 text-right tabular-nums">{formatPeso(m.projectValueCentavos)}</td>
                    <td className="py-2 text-right tabular-nums">{formatPeso(m.purchasesCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Job value uses the agreed booking price; quote-only bookings without an agreed price count as ₱0. Times are
            in Philippine time.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
