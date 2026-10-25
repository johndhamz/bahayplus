"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { AdminCategory } from "@bahayplus/modules/admin";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { Textarea } from "@bahayplus/ui/components/ui/textarea";
import { selectClassName } from "@/components/forms/fields";
import {
  saveCategoryAction,
  setOrganizationStatusAction,
  setUserSuspensionAction,
  updateDisputeAction,
  updatePlatformSettingAction,
} from "@/lib/actions/operations";

type Res = { ok: boolean; error?: { message: string } };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, msg: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) {
          toast.error(r.error?.message ?? "Something went wrong.");
          return resolve(false);
        }
        toast.success(msg);
        router.refresh();
        resolve(true);
      }),
    );
  return { pending, run };
}

/** A privileged action that always asks for a reason (stored in the audit log). */
function ReasonedAction({
  label,
  title,
  description,
  destructive,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmationDialog
      title={title}
      description={
        <span className="flex flex-col gap-2">
          <span>{description}</span>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Reason (recorded in the audit log)
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </span>
      }
      confirmLabel={label}
      tone={destructive ? "destructive" : "default"}
      onConfirm={() => onConfirm(reason)}
      trigger={
        <Button size="sm" variant="outline" className={destructive ? "text-destructive" : undefined}>
          {label}
        </Button>
      }
    />
  );
}

export function OrganizationStatusAction({
  organizationId,
  name,
  status,
}: {
  organizationId: string;
  name: string;
  status: "active" | "suspended";
}) {
  const { run } = useRun();
  return status === "active" ? (
    <ReasonedAction
      label="Suspend"
      title={`Suspend ${name}?`}
      description="Members lose access and the business is removed from the marketplace until reinstated."
      destructive
      onConfirm={(reason) =>
        run(
          () => setOrganizationStatusAction({ organizationId, status: "suspended", reason }),
          "Organization suspended.",
        )
      }
    />
  ) : (
    <ReasonedAction
      label="Reinstate"
      title={`Reinstate ${name}?`}
      description="Members regain access. Marketplace listing still requires current verification."
      onConfirm={(reason) =>
        run(() => setOrganizationStatusAction({ organizationId, status: "active", reason }), "Organization reinstated.")
      }
    />
  );
}

export function UserSuspensionAction({
  userId,
  name,
  suspended,
}: {
  userId: string;
  name: string;
  suspended: boolean;
}) {
  const { run } = useRun();
  return suspended ? (
    <ReasonedAction
      label="Reinstate"
      title={`Reinstate ${name}?`}
      description="They can sign in again."
      onConfirm={(reason) => run(() => setUserSuspensionAction({ userId, suspend: false, reason }), "User reinstated.")}
    />
  ) : (
    <ReasonedAction
      label="Suspend"
      title={`Suspend ${name}?`}
      description="They are signed out everywhere and can't sign in. Their households and businesses are not deleted."
      destructive
      onConfirm={(reason) => run(() => setUserSuspensionAction({ userId, suspend: true, reason }), "User suspended.")}
    />
  );
}

export function CategoryRowActions({ category }: { category: AdminCategory }) {
  const { pending, run } = useRun();
  const save = (patch: Partial<AdminCategory>, msg: string) =>
    run(
      () =>
        saveCategoryAction({
          id: category.id,
          division: category.division,
          slug: category.slug,
          name: category.name,
          description: category.description,
          urgentEligible: category.urgentEligible,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          ...patch,
        }),
      msg,
    );
  return (
    <div className="flex flex-wrap gap-2">
      <label className="flex min-h-10 items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="size-4 accent-[var(--brand)]"
          checked={category.urgentEligible}
          disabled={pending}
          onChange={(e) => save({ urgentEligible: e.target.checked }, "Category updated.")}
        />
        Urgent
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          save({ isActive: !category.isActive }, category.isActive ? "Category hidden." : "Category shown.")
        }
      >
        {category.isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

export function NewCategoryForm() {
  const { pending, run } = useRun();
  const [v, setV] = useState({
    division: "home",
    slug: "",
    name: "",
    description: "",
    urgentEligible: false,
    sortOrder: "100",
  });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => saveCategoryAction({ ...v, id: "", isActive: true }), "Category added."))
          setV({ division: "home", slug: "", name: "", description: "", urgentEligible: false, sortOrder: "100" });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Division
        <select
          className={selectClassName}
          value={v.division}
          onChange={(e) => setV({ ...v, division: e.target.value })}
        >
          <option value="home">Home</option>
          <option value="pet">Pet</option>
          <option value="vehicle">Vehicle</option>
          <option value="renovation">Renovation</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <Input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: v.slug || "" })} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Slug
        <Input
          required
          value={v.slug}
          onChange={(e) => setV({ ...v, slug: e.target.value })}
          placeholder="e.g. water-tank-cleaning"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <Input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </label>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-[var(--brand)]"
          checked={v.urgentEligible}
          onChange={(e) => setV({ ...v, urgentEligible: e.target.checked })}
        />
        Eligible for urgent discovery
      </label>
      <Button type="submit" disabled={pending} className="w-fit">
        Add category
      </Button>
    </form>
  );
}

export function DisputeActions({ disputeId, status }: { disputeId: string; status: string }) {
  const { pending, run } = useRun();
  const [resolution, setResolution] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {status === "open" && (
        <Button
          variant="outline"
          disabled={pending}
          className="w-fit"
          onClick={() =>
            run(() => updateDisputeAction({ disputeId, action: "take", resolution: "" }), "Dispute assigned to you.")
          }
        >
          Take this dispute
        </Button>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Outcome (sent to the customer and the provider)
        <Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            run(() => updateDisputeAction({ disputeId, action: "resolved", resolution }), "Dispute resolved.")
          }
        >
          Mark resolved
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => updateDisputeAction({ disputeId, action: "dismissed", resolution }), "Dispute dismissed.")
          }
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function SettingField({
  settingKey,
  label,
  initial,
  type = "text",
  help,
}: {
  settingKey: "maintenance_banner" | "urgent_stale_hours" | "support_email";
  label: string;
  initial: string;
  type?: string;
  help?: string;
}) {
  const { pending, run } = useRun();
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => updatePlatformSettingAction({ key: settingKey, value }), "Setting saved.");
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        <div className="flex gap-2">
          <Input type={type} value={value} onChange={(e) => setValue(e.target.value)} />
          <Button type="submit" variant="outline" disabled={pending || value === initial}>
            Save
          </Button>
        </div>
      </label>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </form>
  );
}
