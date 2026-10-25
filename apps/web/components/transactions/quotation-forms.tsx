"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { QuotationView } from "@bahayplus/modules/bookings";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { lineTotalCentavos, SaveQuotationDraftInput } from "@bahayplus/validation/transactions/bookings";
import { formatPeso, parsePesoInput } from "@bahayplus/types/money";
import { asAnyControl, TextAreaField } from "@/components/forms/fields";
import {
  acceptProjectQuotationAction,
  createQuotationDraftAction,
  decideQuotationAction,
  saveQuotationDraftAction,
  sendQuotationAction,
  withdrawQuotationAction,
} from "@/lib/actions/transactions";

const toInput = (c: number) => formatPeso(c).replace("₱", "");

export function QuotationDraftEditor({
  draft,
  defaultValidUntil,
}: {
  draft: QuotationView;
  defaultValidUntil: string;
}) {
  const router = useRouter();
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [sending, startSend] = useTransition();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: SaveQuotationDraftInput,
    defaultValues: {
      quotationId: draft.id,
      notes: draft.notes,
      lines: draft.lines.length
        ? draft.lines.map((l) => ({
            description: l.description,
            quantity: String(l.quantity),
            unitLabel: l.unitLabel,
            unitPriceCentavos: toInput(l.unitPriceCentavos),
          }))
        : [{ description: "", quantity: "1", unitLabel: "", unitPriceCentavos: "" }],
    },
    action: saveQuotationDraftAction,
    onSuccess: () => {
      toast.success("Draft saved.");
      router.refresh();
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = useWatch({ control: form.control, name: "lines" });
  const total = lines.reduce((sum, l) => {
    const q = Number(String(l.quantity).replaceAll(",", ""));
    const p = parsePesoInput(String(l.unitPriceCentavos ?? ""))?.amountCentavos;
    return Number.isFinite(q) && q > 0 && p !== undefined ? sum + lineTotalCentavos(q, p) : sum;
  }, 0);
  const err = form.formState.errors.lines;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Quotation line items</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase">
              <th scope="col" className="pb-2 font-semibold">
                Item
              </th>
              <th scope="col" className="w-24 pb-2 font-semibold">
                Qty
              </th>
              <th scope="col" className="w-20 pb-2 font-semibold">
                Unit
              </th>
              <th scope="col" className="w-32 pb-2 font-semibold">
                Unit price (₱)
              </th>
              <th scope="col" className="w-28 pb-2 text-right font-semibold">
                Total
              </th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const q = Number(String(lines[i]?.quantity ?? "").replaceAll(",", ""));
              const p = parsePesoInput(String(lines[i]?.unitPriceCentavos ?? ""))?.amountCentavos;
              return (
                <tr key={f.id} className="align-top">
                  <td className="pr-2 pb-2">
                    <Input aria-label={`Item ${i + 1} description`} {...form.register(`lines.${i}.description`)} />
                  </td>
                  <td className="pr-2 pb-2">
                    <Input
                      aria-label={`Item ${i + 1} quantity`}
                      inputMode="decimal"
                      {...form.register(`lines.${i}.quantity`)}
                    />
                  </td>
                  <td className="pr-2 pb-2">
                    <Input aria-label={`Item ${i + 1} unit`} {...form.register(`lines.${i}.unitLabel`)} />
                  </td>
                  <td className="pr-2 pb-2">
                    <Input
                      aria-label={`Item ${i + 1} unit price`}
                      inputMode="decimal"
                      {...form.register(`lines.${i}.unitPriceCentavos`)}
                    />
                  </td>
                  <td className="pb-2 text-right tabular-nums">
                    {Number.isFinite(q) && q > 0 && p !== undefined ? formatPeso(lineTotalCentavos(q, p)) : "—"}
                  </td>
                  <td className="pb-2 pl-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove item ${i + 1}`}
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4} className="pt-2 text-right">
                Total
              </th>
              <td className="pt-2 text-right font-semibold tabular-nums">{formatPeso(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {err && (
        <p role="alert" className="text-sm text-destructive">
          Check each line: description, quantity above 0, and a unit price.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => append({ description: "", quantity: "1", unitLabel: "", unitPriceCentavos: "" })}
      >
        <Plus aria-hidden="true" /> Add line
      </Button>
      <TextAreaField control={asAnyControl(form.control)} name="notes" label="Notes, terms and inclusions" rows={2} />
      <div className="flex flex-wrap items-end gap-3">
        <SubmitButton pending={pending} variant="outline">
          Save draft
        </SubmitButton>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Valid until
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-44" />
        </label>
        <Button
          type="button"
          disabled={sending || pending}
          onClick={() =>
            startSend(async () => {
              const saved = await saveQuotationDraftAction(form.getValues());
              if (!saved.ok) return void toast.error(saved.error.message);
              const r = await sendQuotationAction({ quotationId: draft.id, validUntil });
              if (!r.ok) return void toast.error(r.error.message);
              toast.success("Quotation sent.");
              router.refresh();
            })
          }
        >
          Save & send to customer
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Once sent, this version can&apos;t be edited. To change prices, create a new version.
      </p>
    </form>
  );
}

export function NewQuotationVersionButton({
  requestId,
  label = "Create quotation",
}: {
  requestId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await createQuotationDraftAction({ requestId });
          if (!r.ok) return void toast.error(r.error.message);
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}

export function WithdrawQuotationButton({ quotationId, isDraft }: { quotationId: string; isDraft: boolean }) {
  const router = useRouter();
  return (
    <ConfirmationDialog
      title={isDraft ? "Delete this draft?" : "Withdraw this quotation?"}
      description={isDraft ? "The draft is deleted." : "The customer can no longer accept it."}
      confirmLabel={isDraft ? "Delete draft" : "Withdraw"}
      tone="destructive"
      onConfirm={async () => {
        const r = await withdrawQuotationAction({ quotationId });
        if (!r.ok) {
          toast.error(r.error.message);
          return false;
        }
        router.refresh();
      }}
      trigger={
        <Button variant="ghost" className="text-destructive">
          {isDraft ? "Delete draft" : "Withdraw"}
        </Button>
      }
    />
  );
}

export function QuotationDecision({
  quotationId,
  total,
  projectId,
}: {
  quotationId: string;
  total: number;
  projectId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [when, setWhen] = useState("");
  const decide = (decision: "accepted" | "rejected") =>
    start(async () => {
      const r =
        projectId && decision === "accepted"
          ? await acceptProjectQuotationAction({ projectId, quotationId })
          : await decideQuotationAction({ quotationId, decision, start: when });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(decision === "accepted" ? "Quotation accepted." : "Quotation declined.");
      if (r.data && typeof r.data === "object" && "bookingId" in r.data && r.data.bookingId)
        router.push(`../${r.data.bookingId}`);
      else router.refresh();
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sage/50 p-3">
      {!projectId && (
        <label className="flex flex-col gap-1 text-sm font-medium sm:w-64">
          Preferred schedule (optional)
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <ConfirmationDialog
          title={`Accept for ${formatPeso(total)}?`}
          description="The price is locked once you accept. Any later change in scope or price needs your approval."
          confirmLabel="Accept quotation"
          onConfirm={() => decide("accepted")}
          trigger={<Button disabled={pending}>Accept</Button>}
        />
        <Button variant="outline" disabled={pending} onClick={() => decide("rejected")}>
          Decline
        </Button>
      </div>
    </div>
  );
}
