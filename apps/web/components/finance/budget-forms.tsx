"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PAYMENT_METHOD_LABELS } from "@bahayplus/modules/bills";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { CreateExpenseInput, SaveBudgetInput } from "@bahayplus/validation/finance/budgets";
import { formatPeso } from "@bahayplus/types/money";
import { asAnyControl, DateField, MoneyField, SelectField, TextField, toOptions } from "@/components/forms/fields";
import { createExpenseAction, saveBudgetAction, voidExpenseAction } from "@/lib/actions/finance";

type Option = { id: string; name: string };

export function ExpenseForm({
  householdId,
  categories,
  properties,
  today,
  defaultPropertyId,
}: {
  householdId: string;
  categories: Option[];
  properties: Option[];
  today: string;
  defaultPropertyId?: string;
}) {
  const router = useRouter();
  const blank = {
    householdId,
    propertyId: defaultPropertyId ?? "",
    categoryId: categories.find((c) => c.name.startsWith("Groceries"))?.id ?? categories[0]?.id ?? "",
    amountCentavos: "",
    spentOn: today,
    description: "",
    paymentMethod: "cash" as const,
  };
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateExpenseInput,
    defaultValues: blank,
    action: createExpenseAction,
    onSuccess: () => {
      toast.success("Expense added.");
      form.reset({ ...blank, categoryId: form.getValues("categoryId") });
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField control={control} name="amountCentavos" label="Amount" required />
        <SelectField
          control={control}
          name="categoryId"
          label="Category"
          required
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <DateField control={control} name="spentOn" label="Date" required />
        <SelectField
          control={control}
          name="paymentMethod"
          label="Paid via"
          options={toOptions(PAYMENT_METHOD_LABELS)}
        />
        <TextField control={control} name="description" label="Description" />
        {properties.length > 0 && (
          <SelectField
            control={control}
            name="propertyId"
            label="Property"
            options={[
              { value: "", label: "Whole household" },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Bill payments are added automatically — don&apos;t add them again here.
      </p>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Add expense
      </SubmitButton>
    </form>
  );
}

export function BudgetLimitsForm({
  householdId,
  month,
  categories,
  limits,
}: {
  householdId: string;
  month: string;
  categories: Option[];
  limits: Record<string, number>;
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: SaveBudgetInput,
    defaultValues: {
      householdId,
      month,
      lines: categories.map((c) => ({
        categoryId: c.id,
        limitCentavos: limits[c.id] !== undefined ? formatPeso(limits[c.id]!).replace("₱", "") : "",
      })),
    },
    action: saveBudgetAction,
    onSuccess: () => {
      toast.success("Budget saved.");
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((c, i) => (
          <MoneyField key={c.id} control={control} name={`lines.${i}.limitCentavos`} label={c.name} />
        ))}
      </div>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Save budget
      </SubmitButton>
    </form>
  );
}

export function VoidExpenseButton({ expenseId, label }: { expenseId: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmationDialog
      title="Remove this expense?"
      description="It will no longer count toward your budget."
      confirmLabel="Remove"
      tone="destructive"
      onConfirm={async () => {
        const r = await voidExpenseAction({ expenseId });
        if (!r.ok) {
          toast.error(r.error.message);
          return false;
        }
        toast.success("Expense removed.");
        router.refresh();
      }}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      }
    />
  );
}
