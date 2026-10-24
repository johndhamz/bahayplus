"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FilterPanel, type FilterValues } from "@bahayplus/ui/components/data/filter-panel";
import { SearchInput } from "@bahayplus/ui/components/data/search-input";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { parsePesoInput } from "@bahayplus/types/money";

const DemoSchema = z.object({
  label: z.string().trim().min(2, "Enter at least 2 characters."),
  amount: z.string().refine((v) => parsePesoInput(v) !== null, "Enter an amount like 1,250.50"),
});

export function ComponentGallery() {
  const [filters, setFilters] = useState<FilterValues>({ status: ["confirmed"] });
  const [query, setQuery] = useState("");
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: DemoSchema,
    defaultValues: { label: "", amount: "" },
    action: async () => ({
      ok: false as const,
      error: { code: "VALIDATION_FAILED" as const, message: "Demo only — nothing was saved." },
    }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-heading text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button onClick={() => toast.success("Saved (demo toast)")}>Show toast</Button>
        </div>
        <ConfirmationDialog
          title="Archive this property?"
          description="Archived properties are hidden but kept with their history. You can restore them later."
          confirmLabel="Archive"
          tone="destructive"
          onConfirm={async () => {
            await new Promise((r) => setTimeout(r, 600));
            toast("Archived (demo)");
          }}
          trigger={
            <Button variant="outline" className="w-fit">
              <Trash2 aria-hidden="true" />
              Open confirmation dialog
            </Button>
          }
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-heading text-lg font-semibold">Form fields</h2>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormAlert message={formError} />
          <FormField control={form.control} name="label" label="Label" required description="Shown on your dashboard.">
            {(field, a11y) => <Input {...field} {...a11y} />}
          </FormField>
          <FormField control={form.control} name="amount" label="Amount (PHP)" required>
            {(field, a11y) => <Input {...field} {...a11y} inputMode="decimal" placeholder="0.00" />}
          </FormField>
          <SubmitButton pending={pending} className="w-fit">
            Validate
          </SubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-heading text-lg font-semibold">Search & filters</h2>
        <SearchInput label="Search bookings" placeholder="Search bookings" onValueChange={setQuery} />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Query: {query || "—"}
        </p>
        <FilterPanel
          groups={[
            {
              id: "status",
              label: "Status",
              type: "checkbox",
              options: [
                { value: "pending", label: "Pending", count: 1 },
                { value: "confirmed", label: "Confirmed", count: 1 },
                { value: "cancelled", label: "Cancelled", count: 1 },
              ],
            },
            {
              id: "city",
              label: "City",
              type: "radio",
              options: [
                { value: "qc", label: "Quezon City" },
                { value: "makati", label: "Makati" },
              ],
            },
          ]}
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters({})}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Error state</h2>
        <ErrorState reference="demo-ref-123" onRetry={() => toast("Retry clicked (demo)")} />
      </section>
    </div>
  );
}
