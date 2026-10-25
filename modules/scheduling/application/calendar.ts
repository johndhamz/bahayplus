import { AssignCalendarItemInput, type CalendarCategory } from "@bahayplus/validation/scheduling/calendar";
import { err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type CalendarItem = {
  itemKey: string;
  householdId: string;
  category: CalendarCategory;
  kind: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  allDayOn: string | null;
  propertyId: string | null;
  assigneeId: string | null;
  status: string;
  link: string;
};

export type CalendarFilter = { category?: CalendarCategory; propertyId?: string; member?: string | "unassigned" };

/** Items across modules for the households and Manila date range (inclusive). RLS applies per source. */
export async function listCalendarItems(
  ctx: ServiceContext,
  householdIds: string[],
  range: { from: string; to: string },
  filter: CalendarFilter = {},
): Promise<Result<CalendarItem[]>> {
  const { data, error } = await ctx.db.rpc("household_calendar", {
    p_households: householdIds,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? [])
      .map((r) => ({
        itemKey: r.item_key,
        householdId: r.household_id,
        category: r.category as CalendarCategory,
        kind: r.kind,
        title: r.title,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        allDayOn: r.all_day_on,
        propertyId: r.property_id,
        assigneeId: r.assignee_id,
        status: r.status,
        link: r.link,
      }))
      .filter(
        (i) =>
          (!filter.category || i.category === filter.category) &&
          (!filter.propertyId || i.propertyId === filter.propertyId) &&
          (!filter.member || (filter.member === "unassigned" ? i.assigneeId === null : i.assigneeId === filter.member)),
      ),
  );
}

export async function assignCalendarItem(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(AssignCalendarItemInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("assign_calendar_item", {
    p_household: v.householdId,
    p_item_key: v.itemKey,
    p_user: v.userId as string,
  });
  return error ? err(mapDbError(error)) : ok(true);
}
