"use client";

import type { ComponentProps, ReactNode } from "react";
import type { Control, FieldValues } from "react-hook-form";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { Input } from "@bahayplus/ui/components/ui/input";
import { Textarea } from "@bahayplus/ui/components/ui/textarea";

/** Loosely typed control so field helpers can be shared by forms whose schemas differ. */
export type AnyControl = Control<FieldValues>;
export const asAnyControl = <T extends FieldValues, C, O>(control: Control<T, C, O>) =>
  control as unknown as AnyControl;

type Base = {
  control: AnyControl;
  name: string;
  label: string;
  required?: boolean;
  description?: ReactNode;
  className?: string;
};

export const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export function TextField({ inputProps, ...base }: Base & { inputProps?: ComponentProps<typeof Input> }) {
  return (
    <FormField {...base}>
      {(field, a11y) => <Input {...field} {...a11y} value={field.value ?? ""} {...inputProps} />}
    </FormField>
  );
}

export function DateField(base: Base) {
  return <TextField {...base} inputProps={{ type: "date" }} />;
}

export function MoneyField(base: Base) {
  return (
    <FormField {...base}>
      {(field, a11y) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          >
            ₱
          </span>
          <Input
            {...field}
            {...a11y}
            value={field.value ?? ""}
            inputMode="decimal"
            placeholder="0.00"
            className="pl-7"
          />
        </div>
      )}
    </FormField>
  );
}

export function SelectField({ options, ...base }: Base & { options: { value: string; label: string }[] }) {
  return (
    <FormField {...base}>
      {(field, a11y) => (
        <select {...field} {...a11y} value={field.value ?? ""} className={selectClassName}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

export function TextAreaField({ rows = 3, ...base }: Base & { rows?: number }) {
  return (
    <FormField {...base}>
      {(field, a11y) => <Textarea {...field} {...a11y} value={field.value ?? ""} rows={rows} />}
    </FormField>
  );
}

export const toOptions = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
