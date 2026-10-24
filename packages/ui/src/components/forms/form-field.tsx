"use client";

import { useId, type ReactNode } from "react";
import {
  useController,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "@bahayplus/ui/lib/utils";

type FieldShellProps = {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function fieldIds(id: string) {
  return { descriptionId: `${id}-description`, errorId: `${id}-error` };
}

/** Presentational label + description + error wrapper. Use directly for non-RHF inputs. */
export function FieldShell({ id, label, description, error, required, className, children }: FieldShellProps) {
  const { descriptionId, errorId } = fieldIds(id);
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-invalid={error ? "true" : undefined}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children}
      {description && !error && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export type FieldControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

type FormFieldProps<T extends FieldValues, N extends FieldPath<T>, TOutput = T> = {
  /** Input values type T may differ from the parsed output (e.g. "" → null); both are supported. */
  control: Control<T, unknown, TOutput>;
  name: N;
  label: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children: (field: ControllerRenderProps<T, N>, controlProps: FieldControlProps) => ReactNode;
};

/**
 * React Hook Form field with accessible wiring: label ↔ input, description and error via
 * aria-describedby, aria-invalid on error. Validation rules come from the shared Zod contract.
 */
export function FormField<T extends FieldValues, N extends FieldPath<T>, TOutput = T>({
  control,
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps<T, N, TOutput>) {
  const id = useId();
  const { field, fieldState } = useController<T, N, TOutput>({ control, name });
  const error = fieldState.error?.message;
  const { descriptionId, errorId } = fieldIds(id);
  const describedBy = error ? errorId : description ? descriptionId : undefined;

  return (
    <FieldShell id={id} label={label} description={description} error={error} required={required} className={className}>
      {children(field, {
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })}
    </FieldShell>
  );
}
