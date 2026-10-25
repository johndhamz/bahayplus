"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { MilestoneView } from "@bahayplus/modules/projects";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { formatPeso } from "@bahayplus/types/money";
import {
  AddMilestoneInput,
  CreateProjectRequestInput,
  PostProjectUpdateInput,
  PROJECT_KINDS,
  ProposeChangeOrderInput,
  UpdateProjectInput,
} from "@bahayplus/validation/transactions/projects";
import { asAnyControl, DateField, MoneyField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import {
  addMilestoneAction,
  createProjectRequestAction,
  decideChangeOrderAction,
  postProjectUpdateAction,
  proposeChangeOrderAction,
  setMilestoneStatusAction,
  startProjectQuotationAction,
  updateProjectAction,
} from "@/lib/actions/transactions";

export const PROJECT_KIND_LABELS: Record<(typeof PROJECT_KINDS)[number], string> = {
  renovation: "Renovation",
  custom_furniture: "Custom furniture",
  carpentry: "Carpentry",
  cabinetry: "Cabinetry",
  painting: "Painting",
  roofing: "Roofing",
  other: "Other",
};

type Option = { id: string; name: string };

export function NewProjectForm({
  householdId,
  organizationId,
  providerName,
  properties,
  defaultPropertyId,
}: {
  householdId: string;
  organizationId: string;
  providerName: string;
  properties: Option[];
  defaultPropertyId: string | null;
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateProjectRequestInput,
    defaultValues: {
      householdId,
      organizationId,
      propertyId: defaultPropertyId ?? properties[0]?.id ?? "",
      kind: "renovation",
      title: "",
      description: "",
      targetEndDate: "",
    },
    action: createProjectRequestAction,
    onSuccess: (d) => {
      toast.success("Project request sent.");
      router.push(`/app/h/${householdId}/projects/${d.projectId}`);
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        Start a project with {providerName}. They&apos;ll schedule a site visit and send a quotation.
      </p>
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="title" label="Project name" required />
        <SelectField
          control={control}
          name="kind"
          label="Type"
          required
          options={PROJECT_KINDS.map((k) => ({ value: k, label: PROJECT_KIND_LABELS[k] }))}
        />
        <SelectField
          control={control}
          name="propertyId"
          label="Where"
          required
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
        <DateField control={control} name="targetEndDate" label="Target finish" />
      </div>
      <TextAreaField
        control={control}
        name="description"
        label="Scope"
        rows={4}
        description="Rooms, materials, measurements and budget range."
      />
      <SubmitButton pending={pending} className="w-full sm:w-fit">
        Send project request
      </SubmitButton>
    </form>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) {
          toast.error(r.error?.message ?? "Something went wrong.");
          return resolve(false);
        }
        toast.success(success);
        router.refresh();
        resolve(true);
      }),
    );
  return { pending, run };
}

export function ProjectPlanForm({
  projectId,
  status,
  siteVisitAt,
  startDate,
  targetEndDate,
}: {
  projectId: string;
  status: string;
  siteVisitAt: string;
  startDate: string;
  targetEndDate: string;
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateProjectInput,
    defaultValues: { projectId, siteVisitAt, startDate, targetEndDate },
    // Setting the first site visit moves a new request forward.
    action: (values) =>
      updateProjectAction({
        ...values,
        status: status === "requested" && values.siteVisitAt ? "site_visit_scheduled" : undefined,
      }),
    onSuccess: () => {
      toast.success("Project updated.");
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <TextField
        control={control}
        name="siteVisitAt"
        label="Site visit (PHT)"
        inputProps={{ type: "datetime-local" }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField control={control} name="startDate" label="Start date" />
        <DateField control={control} name="targetEndDate" label="Target finish" />
      </div>
      <SubmitButton pending={pending} size="sm" className="w-fit">
        Save schedule
      </SubmitButton>
    </form>
  );
}

export function ProjectStatusActions({
  projectId,
  status,
  hasContract,
}: {
  projectId: string;
  status: string;
  hasContract: boolean;
}) {
  const { pending, run } = useRun();
  const [terms, setTerms] = useState("Workmanship warranty: 12 months from completion.");
  const [until, setUntil] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      {!hasContract && status !== "cancelled" && (
        <Button
          disabled={pending}
          onClick={() => run(() => startProjectQuotationAction({ projectId }), "Quotation draft created.")}
        >
          Prepare quotation
        </Button>
      )}
      {hasContract && status === "quoted" && (
        <Button
          disabled={pending}
          onClick={() => run(() => updateProjectAction({ projectId, status: "active" }), "Project started.")}
        >
          Start project
        </Button>
      )}
      {status === "active" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => updateProjectAction({ projectId, status: "on_hold" }), "Project on hold.")}
        >
          Put on hold
        </Button>
      )}
      {status === "on_hold" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => updateProjectAction({ projectId, status: "active" }), "Project resumed.")}
        >
          Resume
        </Button>
      )}
      {status === "active" && (
        <ConfirmationDialog
          title="Mark project completed?"
          description={
            <span className="flex flex-col gap-2 text-foreground">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Warranty until
                <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Warranty terms
                <Input value={terms} onChange={(e) => setTerms(e.target.value)} />
              </label>
            </span>
          }
          confirmLabel="Complete project"
          onConfirm={() =>
            run(
              () => updateProjectAction({ projectId, status: "completed", warrantyUntil: until, warrantyTerms: terms }),
              "Project completed.",
            )
          }
          trigger={<Button disabled={pending}>Mark completed</Button>}
        />
      )}
    </div>
  );
}

export function MilestoneList({ milestones, canManage }: { milestones: MilestoneView[]; canManage: boolean }) {
  const { pending, run } = useRun();
  if (!milestones.length) return <p className="text-sm text-muted-foreground">No milestones yet.</p>;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {milestones.map((m, i) => (
        <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
          <span className="grid size-7 place-items-center rounded-full bg-sage text-xs font-semibold text-brand">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${m.status === "done" ? "line-through opacity-70" : ""}`}>{m.title}</p>
            <p className="text-xs text-muted-foreground">
              {m.dueOn ? `Due ${m.dueOn}` : "No due date"}
              {m.amountCentavos !== null ? ` · ${formatPeso(m.amountCentavos)}` : ""}
            </p>
          </div>
          {canManage ? (
            <select
              aria-label={`Status of ${m.title}`}
              className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
              value={m.status}
              disabled={pending}
              onChange={(e) =>
                run(() => setMilestoneStatusAction({ milestoneId: m.id, status: e.target.value }), "Milestone updated.")
              }
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {m.status === "in_progress" ? "In progress" : m.status === "done" ? "Done" : "Pending"}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: AddMilestoneInput,
    defaultValues: { projectId, title: "", dueOn: "", amountCentavos: "" },
    action: addMilestoneAction,
    onSuccess: () => {
      toast.success("Milestone added.");
      form.reset({ projectId, title: "", dueOn: "", amountCentavos: "" });
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 border-t border-border pt-3">
      <FormAlert message={formError} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField control={control} name="title" label="Milestone" required />
        <DateField control={control} name="dueOn" label="Due" />
        <MoneyField control={control} name="amountCentavos" label="Amount" />
      </div>
      <SubmitButton pending={pending} size="sm" variant="outline" className="w-fit">
        Add milestone
      </SubmitButton>
    </form>
  );
}

export function PostUpdateForm({ projectId, showProgress }: { projectId: string; showProgress: boolean }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: PostProjectUpdateInput,
    defaultValues: { projectId, body: "", percentComplete: "" },
    action: postProjectUpdateAction,
    onSuccess: () => {
      toast.success("Update posted.");
      form.reset({ projectId, body: "", percentComplete: "" });
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <TextAreaField control={control} name="body" label="Progress update" rows={2} required />
      {showProgress && (
        <TextField
          control={control}
          name="percentComplete"
          label="Percent complete"
          inputProps={{ inputMode: "numeric", className: "w-28" }}
        />
      )}
      <SubmitButton pending={pending} size="sm" className="w-fit">
        Post update
      </SubmitButton>
    </form>
  );
}

export function ProposeChangeOrderForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: ProposeChangeOrderInput,
    defaultValues: { projectId, title: "", description: "", amountDeltaCentavos: "", scheduleDeltaDays: "0" },
    action: proposeChangeOrderAction,
    onSuccess: () => {
      toast.success("Change order sent to the customer.");
      form.reset({ projectId, title: "", description: "", amountDeltaCentavos: "", scheduleDeltaDays: "0" });
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 border-t border-border pt-3">
      <FormAlert message={formError} />
      <TextField control={control} name="title" label="Change" required />
      <TextAreaField control={control} name="description" label="Details" rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          control={control}
          name="amountDeltaCentavos"
          label="Price change (₱)"
          required
          description="Use a minus sign for a reduction."
          inputProps={{ inputMode: "decimal" }}
        />
        <TextField
          control={control}
          name="scheduleDeltaDays"
          label="Schedule change (days)"
          inputProps={{ inputMode: "numeric" }}
        />
      </div>
      <SubmitButton pending={pending} size="sm" variant="outline" className="w-fit">
        Propose change order
      </SubmitButton>
    </form>
  );
}

export function ChangeOrderDecision({
  changeOrderId,
  title,
  amountDeltaCentavos,
}: {
  changeOrderId: string;
  title: string;
  amountDeltaCentavos: number;
}) {
  const { pending, run } = useRun();
  const sign = amountDeltaCentavos >= 0 ? "+" : "−";
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmationDialog
        title={`Approve "${title}"?`}
        description={`The project price changes by ${sign}${formatPeso(Math.abs(amountDeltaCentavos))}.`}
        confirmLabel="Approve change"
        onConfirm={() =>
          run(() => decideChangeOrderAction({ changeOrderId, decision: "approved", note: "" }), "Change approved.")
        }
        trigger={
          <Button size="sm" disabled={pending}>
            Approve
          </Button>
        }
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => decideChangeOrderAction({ changeOrderId, decision: "rejected", note: "" }), "Change rejected.")
        }
      >
        Reject
      </Button>
    </div>
  );
}
