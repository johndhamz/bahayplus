import { addDays, manilaDateOf, type IsoDate } from "@bahayplus/types/dates";
import { err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, type ServiceContext } from "@bahayplus/modules/authorization";
import { classifyDue, dueKindLabel, type DueStatus } from "../domain/due";

export type DueItem = {
  subjectType: "asset" | "pet" | "vehicle";
  subjectId: string;
  subjectName: string;
  dueKind: string;
  label: string;
  dueOn: IsoDate;
  status: DueStatus;
  days: number;
};

/**
 * Upcoming and overdue items from the registry (warranties, maintenance, vaccinations, LTO
 * registration, insurance). RLS on the underlying tables decides what the caller sees.
 */
export async function listDueItems(
  ctx: ServiceContext,
  householdId: string,
  options: { horizonDays?: number; today?: IsoDate; subject?: { type: DueItem["subjectType"]; id: string } } = {},
): Promise<Result<DueItem[]>> {
  const today = options.today ?? manilaDateOf(new Date());
  let query = ctx.db
    .from("registry_due_items")
    .select("subject_type, subject_id, subject_name, due_kind, due_on")
    .eq("household_id", householdId)
    .lte("due_on", addDays(today, options.horizonDays ?? 60))
    .order("due_on");
  if (options.subject) query = query.eq("subject_type", options.subject.type).eq("subject_id", options.subject.id);
  const { data, error } = await query;
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? [])
      .filter((r) => r.due_on && r.subject_id && r.subject_type && r.due_kind)
      .map((r) => {
        const { status, days } = classifyDue(r.due_on!, today);
        return {
          subjectType: r.subject_type as DueItem["subjectType"],
          subjectId: r.subject_id!,
          subjectName: r.subject_name ?? "",
          dueKind: r.due_kind!,
          label: dueKindLabel(r.due_kind!),
          dueOn: r.due_on!,
          status,
          days,
        };
      }),
  );
}
