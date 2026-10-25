import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PAYMENT_METHOD_LABELS } from "@bahayplus/modules/bills";
import {
  budgetVsActual,
  listCategories,
  listExpenses,
  monthlySpending,
  percentLabel,
} from "@bahayplus/modules/budgets";
import { listProperties } from "@bahayplus/modules/properties";
import { ColumnChart } from "@bahayplus/ui/components/data/column-chart";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { cn } from "@bahayplus/ui/lib/utils";
import { addMonthsClamped, formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { MonthKey } from "@bahayplus/validation/finance/budgets";
import { BudgetLimitsForm, ExpenseForm, VoidExpenseButton } from "@/components/finance/budget-forms";
import { selectClassName } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Budget" };

const monthName = (key: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("en-PH", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00Z`));

export default async function BudgetPage({ params, searchParams }: PageProps<"/app/h/[householdId]/budget">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("budget.view")) notFound();
  const ctx = await requireServiceContext();
  const today = manilaDateOf(new Date());
  const month = MonthKey.safeParse(sp.month).success ? (sp.month as string) : today.slice(0, 7);
  const propertyId = typeof sp.property === "string" && sp.property ? sp.property : undefined;
  const base = `/app/h/${householdId}`;
  const [rows, trend, expenses, categories, properties] = await Promise.all([
    budgetVsActual(ctx, householdId, month, propertyId),
    monthlySpending(ctx, householdId, 6, propertyId),
    listExpenses(ctx, householdId, { monthKey: month, propertyId }),
    listCategories(ctx, householdId),
    access.permissions.has("property.view") ? listProperties(ctx, householdId) : null,
  ]);
  const canManage = access.permissions.has("budget.manage");
  const prev = addMonthsClamped(`${month}-01`, -1).slice(0, 7);
  const next = addMonthsClamped(`${month}-01`, 1).slice(0, 7);
  const query = (m: string) => `${base}/budget?month=${m}${propertyId ? `&property=${propertyId}` : ""}`;

  if (!rows.ok) return <ErrorState description="We couldn't load your budget." />;
  const totalSpent = rows.value.reduce((s, r) => s + r.spentCentavos, 0);
  const totalLimit = rows.value.reduce((s, r) => s + (r.limitCentavos ?? 0), 0);
  const overCount = rows.value.filter((r) => r.state === "over").length;
  const limits = Object.fromEntries(
    rows.value.filter((r) => r.limitCentavos !== null).map((r) => [r.categoryId, r.limitCentavos!]),
  );
  const props = properties?.ok ? properties.value.map((p) => ({ id: p.id, name: p.name })) : [];

  return (
    <>
      <PageHeader
        title="Budget"
        description="Monthly budget versus what you actually spent."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Budget" }]}
      />
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-3"
      >
        <nav aria-label="Month" className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={query(prev)} aria-label={`Previous month, ${monthName(prev)}`}>
              ‹
            </Link>
          </Button>
          <span className="min-w-36 text-center font-heading font-semibold" aria-live="polite">
            {monthName(month)}
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link href={query(next)} aria-label={`Next month, ${monthName(next)}`}>
              ›
            </Link>
          </Button>
        </nav>
        <input type="hidden" name="month" value={month} />
        {props.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Property
            <select name="property" defaultValue={propertyId ?? ""} className={cn(selectClassName, "min-w-44")}>
              <option value="">Whole household</option>
              {props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {props.length > 0 && (
          <Button type="submit" variant="outline" size="sm">
            Apply
          </Button>
        )}
      </form>

      <section aria-label="Month summary" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Spent" value={formatPeso(totalSpent)} icon={Wallet} tone="brand" />
        <StatCard
          label="Budgeted"
          value={totalLimit ? formatPeso(totalLimit) : "—"}
          hint={totalLimit ? `${formatPeso(Math.max(totalLimit - totalSpent, 0))} left` : "Set limits below"}
        />
        <StatCard
          label="Categories over budget"
          value={overCount}
          icon={overCount ? AlertTriangle : CheckCircle2}
          tone={overCount ? "terracotta" : "default"}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Budget vs actual" id="budget-vs-actual" className="lg:col-span-2">
          {rows.value.length === 0 ? (
            <EmptyState
              size="compact"
              icon={Wallet}
              title="Nothing yet this month"
              description="Set category limits and record expenses — bill payments are added automatically."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.value.map((r) => {
                const pct = r.basisPoints === null ? 0 : Math.min(r.basisPoints, 10_000) / 100;
                return (
                  <li key={r.categoryId} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{r.categoryName}</span>
                      <span className="text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{formatPeso(r.spentCentavos)}</span>
                        {r.limitCentavos !== null && ` of ${formatPeso(r.limitCentavos)}`}
                      </span>
                    </div>
                    {r.limitCentavos !== null && (
                      <div
                        role="meter"
                        aria-label={`${r.categoryName} budget used`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                        aria-valuetext={`${percentLabel(r.basisPoints ?? 0)} used${r.state === "over" ? ", over budget" : ""}`}
                        className="h-2.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            r.state === "over" ? "bg-destructive" : r.state === "warning" ? "bg-gold" : "bg-brand",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {r.state === "over" && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle aria-hidden="true" className="size-3.5" /> Over by{" "}
                        {formatPeso(r.spentCentavos - (r.limitCentavos ?? 0))}
                      </span>
                    )}
                    {r.state === "warning" && (
                      <span className="text-xs font-medium text-warning">{percentLabel(r.basisPoints ?? 0)} used</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Spending trend" id="trend">
          {trend.ok ? (
            <ColumnChart
              title="Monthly spending, last 6 months"
              valueFormat="peso"
              data={trend.value.map((t) => ({
                key: t.month,
                label: monthName(t.month.slice(0, 7), "short"),
                value: t.spentCentavos,
                display: formatPeso(t.spentCentavos),
              }))}
            />
          ) : (
            <ErrorState description="We couldn't load the trend." />
          )}
        </SectionCard>

        {canManage && categories.ok && (
          <SectionCard title="Add an expense" id="add-expense" className="lg:col-span-2">
            <ExpenseForm
              householdId={householdId}
              categories={categories.value}
              properties={props}
              today={today}
              defaultPropertyId={propertyId}
            />
          </SectionCard>
        )}

        <SectionCard
          title={`Expenses in ${monthName(month)}`}
          id="expenses"
          className={canManage ? "" : "lg:col-span-3"}
        >
          {expenses.ok && expenses.value.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {expenses.value.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.description || e.categoryName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatManilaDate(e.spentOn)} · {e.categoryName} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                      {e.source === "bill_payment" ? " · from bill" : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatPeso(e.amountCentavos)}</span>
                  {canManage && e.source === "manual" && (
                    <VoidExpenseButton expenseId={e.id} label={e.description || e.categoryName} />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No expenses this month.</p>
          )}
        </SectionCard>

        {canManage && categories.ok && (
          <SectionCard title={`Limits for ${monthName(month)}`} id="limits" className="lg:col-span-3">
            <BudgetLimitsForm
              key={month}
              householdId={householdId}
              month={month}
              categories={categories.value}
              limits={limits}
            />
          </SectionCard>
        )}
      </div>
    </>
  );
}
