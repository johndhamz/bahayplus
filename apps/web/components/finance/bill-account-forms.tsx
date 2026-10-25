"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWatch } from "react-hook-form";
import {
  BILL_TYPE_LABELS,
  BILLER_SUGGESTIONS,
  reminderOffsetLabel,
  type BillAccountView,
} from "@bahayplus/modules/bills";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import {
  CreateBillAccountInput,
  DEFAULT_REMINDER_OFFSETS,
  UpdateBillAccountInput,
} from "@bahayplus/validation/finance/bills";
import { formatPeso } from "@bahayplus/types/money";
import {
  asAnyControl,
  DateField,
  MoneyField,
  SelectField,
  TextField,
  toOptions,
  type AnyControl,
} from "@/components/forms/fields";
import { createBillAccountAction, updateBillAccountAction } from "@/lib/actions/finance";

export type Option = { id: string; name: string };
const REMINDER_CHOICES = [14, 7, 3, 1, 0, -1, -3, -7];

function initial(a?: BillAccountView) {
  return {
    propertyId: a?.propertyId ?? "",
    billType: a?.billType ?? "electricity",
    providerName: a?.providerName ?? "",
    nickname: a?.nickname ?? "",
    accountNumberLast4: a?.accountNumberLast4 ?? "",
    categoryId: a?.categoryId ?? "",
    amountType: a?.amountType ?? "variable",
    fixedAmountCentavos: a?.fixedAmountCentavos != null ? formatPeso(a.fixedAmountCentavos).replace("₱", "") : "",
    isRecurring: a?.isRecurring ?? true,
    dueDay: a?.dueDay?.toString() ?? "",
    endsOn: a?.endsOn ?? "",
    reminderOffsets: a?.reminderOffsets ?? [...DEFAULT_REMINDER_OFFSETS],
  };
}

function AccountFields({
  control,
  register,
  properties,
  categories,
}: {
  control: AnyControl;
  register: (name: string) => object;
  properties: Option[];
  categories: Option[];
}) {
  const billType = useWatch({ control, name: "billType" }) as keyof typeof BILLER_SUGGESTIONS;
  const amountType = useWatch({ control, name: "amountType" });
  const recurring = useWatch({ control, name: "isRecurring" });
  const suggestions = BILLER_SUGGESTIONS[billType] ?? [];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="billType"
          label="Bill type"
          required
          options={toOptions(BILL_TYPE_LABELS)}
        />
        <TextField
          control={control}
          name="providerName"
          label="Biller"
          required
          description={suggestions.length ? `e.g. ${suggestions.join(", ")}` : undefined}
          inputProps={{ list: "biller-suggestions", autoComplete: "off" }}
        />
        <datalist id="biller-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <TextField control={control} name="nickname" label="Nickname" description='e.g. "Condo electricity"' />
        <TextField
          control={control}
          name="accountNumberLast4"
          label="Account number"
          description="Only the last 4 characters are kept."
          inputProps={{ autoComplete: "off" }}
        />
        <SelectField
          control={control}
          name="propertyId"
          label="Property"
          options={[{ value: "", label: "Not assigned" }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <SelectField
          control={control}
          name="categoryId"
          label="Budget category"
          options={[
            { value: "", label: "Automatic (by bill type)" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
      <fieldset className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Amount & schedule</legend>
        <SelectField
          control={control}
          name="amountType"
          label="Amount"
          required
          options={[
            { value: "variable", label: "Varies each month (enter from statement)" },
            { value: "fixed", label: "Same every month" },
          ]}
        />
        {amountType === "fixed" && (
          <MoneyField control={control} name="fixedAmountCentavos" label="Monthly amount" required />
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--brand)]" {...register("isRecurring")} />
          Bills every month (Bahay+ creates each month&apos;s bill automatically)
        </label>
        {recurring && (
          <TextField
            control={control}
            name="dueDay"
            label="Due day of month"
            required
            description="31 means the last day of shorter months."
            inputProps={{ inputMode: "numeric" }}
          />
        )}
        {recurring && (
          <DateField control={control} name="endsOn" label="Ends on" description="Leave empty if ongoing." />
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Reminders</legend>
        <p className="text-xs text-muted-foreground">
          In-app reminders for unpaid bills. They stop once the bill is fully paid.
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {REMINDER_CHOICES.map((offset) => (
            <label key={offset} className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                value={offset}
                className="size-5 accent-[var(--brand)]"
                {...register("reminderOffsets")}
              />
              {reminderOffsetLabel(offset)}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function CreateBillAccountForm({
  householdId,
  properties,
  categories,
  defaultPropertyId,
}: {
  householdId: string;
  properties: Option[];
  categories: Option[];
  defaultPropertyId: string | null;
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateBillAccountInput,
    defaultValues: {
      ...initial(),
      propertyId: defaultPropertyId ?? "",
      householdId,
      reminderOffsets: DEFAULT_REMINDER_OFFSETS.map(String) as unknown as number[],
    },
    action: createBillAccountAction,
    onSuccess: (d) => {
      toast.success("Bill added.");
      router.push(`/app/h/${householdId}/bills/accounts/${d.accountId}`);
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <AccountFields
        control={asAnyControl(form.control)}
        register={form.register as unknown as (n: string) => object}
        properties={properties}
        categories={categories}
      />
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg" className="w-full sm:w-fit">
        Add bill
      </SubmitButton>
    </form>
  );
}

export function EditBillAccountForm({
  account,
  properties,
  categories,
}: {
  account: BillAccountView;
  properties: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateBillAccountInput,
    defaultValues: {
      ...initial(account),
      accountId: account.id,
      reminderOffsets: account.reminderOffsets.map(String) as unknown as number[],
    },
    action: updateBillAccountAction,
    onSuccess: () => {
      toast.success("Account saved.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <AccountFields
        control={asAnyControl(form.control)}
        register={form.register as unknown as (n: string) => object}
        properties={properties}
        categories={categories}
      />
      <p className="text-xs text-muted-foreground">
        Changes apply to bills generated from now on; existing bills keep their amounts.
      </p>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Save changes
      </SubmitButton>
    </form>
  );
}
