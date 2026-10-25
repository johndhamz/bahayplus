import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { listHouseholdMembers } from "@bahayplus/modules/households";
import { listProperties } from "@bahayplus/modules/properties";
import {
  CALENDAR_CATEGORY_LABELS,
  listCalendarItems,
  manilaDayOf,
  monthGrid,
  monthRange,
  shiftMonth,
  type CalendarItem,
} from "@bahayplus/modules/scheduling";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { cn } from "@bahayplus/ui/lib/utils";
import { CALENDAR_CATEGORIES, CalendarQuery, type CalendarCategory } from "@bahayplus/validation/scheduling/calendar";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { AssignSelect } from "@/components/calendar/assign-select";
import { selectClassName } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { getMyContexts, requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Calendar" };

const CATEGORY_DOT: Record<CalendarCategory, string> = {
  bills: "bg-terracotta",
  assets: "bg-brand",
  pets: "bg-gold",
  vehicles: "bg-info",
  bookings: "bg-success",
  projects: "bg-muted-foreground",
};

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

export default async function CalendarPage({ params, searchParams }: PageProps<"/app/h/[householdId]/calendar">) {
  const { householdId } = await params;
  const query = CalendarQuery.parse(await searchParams);
  const access = await requireHouseholdAccess(householdId);
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const today = manilaDateOf(new Date());
  const month = query.month ?? today.slice(0, 7);
  const contexts = await getMyContexts();
  const households = contexts.filter((c) => c.kind === "household" && c.id).map((c) => ({ id: c.id!, name: c.name }));
  const householdIds = query.scope === "all" ? households.map((h) => h.id) : [householdId];
  const [items, members, properties] = await Promise.all([
    listCalendarItems(ctx, householdIds, monthRange(month), {
      category: query.category,
      propertyId: query.property,
      member: query.member,
    }),
    access.permissions.has("household.members.view") ? listHouseholdMembers(ctx, householdId) : null,
    access.permissions.has("property.view") ? listProperties(ctx, householdId) : null,
  ]);
  if (!items.ok) return <ErrorState description="We couldn't load the calendar." />;

  const memberOptions = (members?.ok ? members.value : [])
    .filter((m) => m.status === "active")
    .map((m) => ({ userId: m.userId, name: m.fullName || "Member" }));
  const memberName = new Map(memberOptions.map((m) => [m.userId, m.name]));
  const householdName = new Map(households.map((h) => [h.id, h.name]));
  const canAssign = access.permissions.has("calendar.assign");
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items.value) {
    const day = manilaDayOf(item);
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  const days = [...byDay.keys()].sort();
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      month,
      category: query.category,
      property: query.property,
      member: query.member,
      scope: query.scope === "all" ? "all" : undefined,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `${base}/calendar?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Bills, maintenance, pet care, bookings and renovation milestones in one place."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Calendar" }]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon" aria-label="Previous month">
          <Link href={qs({ month: shiftMonth(month, -1) })}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <h2 className="min-w-40 text-center font-heading text-lg font-semibold">{monthLabel(month)}</h2>
        <Button asChild variant="outline" size="icon" aria-label="Next month">
          <Link href={qs({ month: shiftMonth(month, 1) })}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
        {month !== today.slice(0, 7) && (
          <Button asChild variant="ghost" size="sm">
            <Link href={qs({ month: today.slice(0, 7) })}>Today</Link>
          </Button>
        )}
      </div>

      <form
        method="get"
        aria-label="Calendar filters"
        className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <input type="hidden" name="month" value={month} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Household
          <select name="scope" defaultValue={query.scope} className={selectClassName}>
            <option value="household">{access.householdName}</option>
            {households.length > 1 && <option value="all">All my households</option>}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select name="category" defaultValue={query.category ?? ""} className={selectClassName}>
            <option value="">All categories</option>
            {CALENDAR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CALENDAR_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Property
          <select name="property" defaultValue={query.property ?? ""} className={selectClassName}>
            <option value="">All properties</option>
            {(properties?.ok ? properties.value : []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Assigned to
          <select name="member" defaultValue={query.member ?? ""} className={selectClassName}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {memberOptions.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>

      <section
        aria-label="Month view"
        className="mb-6 hidden overflow-hidden rounded-2xl border border-border bg-surface md:block"
      >
        <div className="grid grid-cols-7 border-b border-border text-center text-xs font-semibold text-muted-foreground uppercase">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {monthGrid(month).map((week, w) => (
          <div key={w} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, i) => {
              const dayItems = day ? (byDay.get(day) ?? []) : [];
              return (
                <div
                  key={day ?? `pad-${w}-${i}`}
                  className={cn("min-h-24 border-r border-border p-1.5 last:border-r-0", !day && "bg-muted/40")}
                >
                  {day && (
                    <>
                      <p
                        className={cn(
                          "mb-1 text-xs font-semibold",
                          day === today &&
                            "inline-grid size-6 place-items-center rounded-full bg-brand text-brand-foreground",
                        )}
                      >
                        {Number(day.slice(8))}
                      </p>
                      <ul className="flex flex-col gap-0.5">
                        {dayItems.slice(0, 3).map((it) => (
                          <li key={it.itemKey} className="flex items-center gap-1 truncate text-xs">
                            <span
                              aria-hidden="true"
                              className={cn("size-1.5 shrink-0 rounded-full", CATEGORY_DOT[it.category])}
                            />
                            <Link href={it.link} className="truncate hover:underline">
                              {it.title}
                            </Link>
                          </li>
                        ))}
                        {dayItems.length > 3 && (
                          <li>
                            <a href={`#day-${day}`} className="text-xs font-medium text-brand hover:underline">
                              +{dayItems.length - 3} more
                            </a>
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section aria-labelledby="agenda-heading">
        <h2 id="agenda-heading" className="mb-3 font-heading text-lg font-semibold">
          Agenda
        </h2>
        {days.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            description="No items match these filters this month."
            size="compact"
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {days.map((day) => (
              <li key={day} id={`day-${day}`} className="scroll-mt-20">
                <h3
                  className={cn("mb-2 text-sm font-semibold", day === today ? "text-brand" : "text-muted-foreground")}
                >
                  {day === today ? `Today · ${formatManilaDate(day)}` : dayLabel(day)}
                </h3>
                <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                  {byDay.get(day)!.map((it) => (
                    <li key={it.itemKey} className="flex flex-wrap items-center gap-3 p-3">
                      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                        {it.startsAt ? timeOf(it.startsAt) : "All day"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={it.link} className="text-sm font-medium hover:underline">
                          {it.title}
                        </Link>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden="true" className={cn("size-2 rounded-full", CATEGORY_DOT[it.category])} />
                          {CALENDAR_CATEGORY_LABELS[it.category]}
                          {query.scope === "all" && <> · {householdName.get(it.householdId)}</>}
                          {it.householdId !== householdId || !canAssign ? (
                            it.assigneeId ? (
                              <> · {memberName.get(it.assigneeId) ?? "Member"}</>
                            ) : null
                          ) : null}
                        </p>
                      </div>
                      {canAssign && it.householdId === householdId && (
                        <AssignSelect
                          householdId={householdId}
                          itemKey={it.itemKey}
                          title={it.title}
                          current={it.assigneeId}
                          members={memberOptions}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
