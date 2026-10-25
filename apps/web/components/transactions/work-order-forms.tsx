"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  WORK_ORDER_NEXT,
  type FieldWorker,
  type WorkOrderStatus,
  type WorkOrderView,
} from "@bahayplus/modules/bookings";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Checkbox } from "@bahayplus/ui/components/ui/checkbox";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { CreateWorkOrderInput } from "@bahayplus/validation/transactions/bookings";
import { asAnyControl, TextAreaField, TextField } from "@/components/forms/fields";
import {
  assignWorkOrderAction,
  createWorkOrderAction,
  toggleChecklistItemAction,
  updateWorkOrderStatusAction,
} from "@/lib/actions/transactions";

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  scheduled: "Unassigned",
  assigned: "Assigned",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

type Source = { value: string; label: string; kind: "booking" | "project" };

export function CreateWorkOrderForm({
  sources,
  defaultSource,
  hrefBase,
}: {
  sources: Source[];
  defaultSource?: string;
  hrefBase: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState(defaultSource ?? sources[0]?.value ?? "");
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const kindOf = (v: string) => sources.find((s) => s.value === v)?.kind;
  const kind = kindOf(source);
  const ids = (v: string) => ({
    bookingId: kindOf(v) === "booking" ? v : "",
    projectId: kindOf(v) === "project" ? v : "",
  });
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateWorkOrderInput,
    defaultValues: { ...ids(source), title: "", instructions: "", start: "", end: "", checklist: [] },
    action: (values) => createWorkOrderAction({ ...values, checklist: items }),
    onSuccess: (d) => {
      toast.success("Work order created.");
      router.push(`${hrefBase}/${d.workOrderId}`);
    },
  });
  const control = asAnyControl(form.control);
  if (!sources.length)
    return <p className="text-sm text-muted-foreground">Confirm a booking or accept a project first.</p>;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        For
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            const next = ids(e.target.value);
            form.setValue("bookingId", next.bookingId);
            form.setValue("projectId", next.projectId);
          }}
          className="h-11 rounded-lg border border-input bg-surface px-3 text-sm"
        >
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <TextField control={control} name="title" label="Title" description="Defaults to the booking or project title." />
      {kind === "project" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            control={control}
            name="start"
            label="Start (PHT)"
            required
            inputProps={{ type: "datetime-local" }}
          />
          <TextField control={control} name="end" label="End (PHT)" required inputProps={{ type: "datetime-local" }} />
        </div>
      )}
      <TextAreaField control={control} name="instructions" label="Instructions for the worker" rows={2} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Checklist</legend>
        {items.map((it, i) => (
          <div key={`${it}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{it}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${it}`}
              onClick={() => setItems(items.filter((_, j) => j !== i))}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            aria-label="New checklist item"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Photo before work"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (draft.trim().length >= 2) setItems([...items, draft.trim()]);
              setDraft("");
            }}
          >
            <Plus aria-hidden="true" /> Add
          </Button>
        </div>
      </fieldset>
      <SubmitButton pending={pending} className="w-fit">
        Create work order
      </SubmitButton>
    </form>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error?.message ?? "Something went wrong.");
      toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

export function AssignWorkerForm({
  workOrderId,
  workers,
  current,
}: {
  workOrderId: string;
  workers: FieldWorker[];
  current: string | null;
}) {
  const { pending, run } = useRun();
  const [worker, setWorker] = useState(current ?? workers[0]?.userId ?? "");
  if (!workers.length) return <p className="text-sm text-muted-foreground">Add a worker to your team first.</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Worker
        <select
          value={worker}
          onChange={(e) => setWorker(e.target.value)}
          className="h-11 rounded-lg border border-input bg-surface px-3 text-sm"
        >
          {workers.map((w) => (
            <option key={w.userId} value={w.userId}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={pending || !worker || worker === current}
        onClick={() => run(() => assignWorkOrderAction({ workOrderId, workerId: worker }), "Worker assigned.")}
      >
        {current ? "Reassign" : "Assign"}
      </Button>
    </div>
  );
}

export function WorkOrderStatusActions({ workOrder }: { workOrder: WorkOrderView }) {
  const { pending, run } = useRun();
  const [notes, setNotes] = useState("");
  const next = WORK_ORDER_NEXT[workOrder.status];
  if (!next.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {next.includes("completed") && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Completion notes
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <Button
            key={s}
            variant={s === "cancelled" ? "outline" : "default"}
            className={s === "cancelled" ? "text-destructive" : undefined}
            disabled={pending}
            onClick={() =>
              run(() => updateWorkOrderStatusAction({ workOrderId: workOrder.id, status: s, notes }), "Status updated.")
            }
          >
            {s === "cancelled" ? "Cancel work order" : `Mark ${WORK_ORDER_STATUS_LABELS[s].toLowerCase()}`}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function Checklist({ items, canToggle }: { items: WorkOrderView["checklist"]; canToggle: boolean }) {
  const { pending, run } = useRun();
  if (!items.length) return <p className="text-sm text-muted-foreground">No checklist items.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c) => (
        <li key={c.id}>
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <Checkbox
              checked={c.isDone}
              disabled={!canToggle || pending}
              onCheckedChange={(v) =>
                run(() => toggleChecklistItemAction({ itemId: c.id, done: v === true }), "Checklist updated.")
              }
            />
            <span className={c.isDone ? "line-through opacity-70" : ""}>{c.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
