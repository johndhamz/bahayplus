"use client";

import { useState, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import type { z } from "zod";
import type { ActionResult } from "@bahayplus/types/action-result";
import { zodResolver } from "@bahayplus/ui/lib/zod-resolver";

/**
 * Binds a Zod contract + React Hook Form to a Server Action. Client validation is for UX only;
 * the action re-validates with the same contract. Server field errors are mapped back onto fields.
 */
export function useActionForm<TSchema extends z.ZodType<FieldValues, FieldValues>, TData>(options: {
  schema: TSchema;
  defaultValues: DefaultValues<z.input<TSchema>>;
  action: (values: z.output<TSchema>) => Promise<ActionResult<TData>>;
  onSuccess?: (data: TData, message?: string) => void;
}) {
  const form = useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(options.schema),
    defaultValues: options.defaultValues,
    mode: "onTouched",
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await options.action(values);
      if (!result) return; // redirected
      if (result.ok) {
        options.onSuccess?.(result.data, result.message);
        return;
      }
      const fieldErrors = result.error.fieldErrors ?? {};
      let mapped = false;
      for (const [name, message] of Object.entries(fieldErrors)) {
        if (name === "_form") continue;
        form.setError(name as Path<z.input<TSchema>>, { type: "server", message });
        mapped = true;
      }
      if (!mapped || fieldErrors._form) setFormError(fieldErrors._form ?? result.error.message);
    });
  });

  return { form, onSubmit, pending, formError, setFormError };
}
