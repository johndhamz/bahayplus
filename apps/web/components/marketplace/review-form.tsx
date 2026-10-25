"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { SubmitReviewInput } from "@bahayplus/validation/marketplace/trust";
import { asAnyControl, TextAreaField } from "@/components/forms/fields";
import { submitReviewAction } from "@/lib/actions/marketplace";

/** Star rating as a radio group (keyboard and screen-reader friendly), plus an optional comment. */
export function ReviewForm({ bookingId, providerName }: { bookingId: string; providerName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: SubmitReviewInput,
    defaultValues: { bookingId, rating: 0, comment: "" },
    action: submitReviewAction,
    onSuccess: () => {
      toast.success("Thanks for your review!");
      router.refresh();
    },
  });
  const ratingError = form.formState.errors.rating?.message;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <fieldset aria-describedby={ratingError ? `${bookingId}-rating-error` : undefined}>
        <legend className="mb-1 text-sm font-medium">Rate {providerName}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={`rating-${bookingId}`}
                value={n}
                className="peer sr-only"
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  form.setValue("rating", n, { shouldValidate: true });
                }}
              />
              <span
                aria-hidden="true"
                className={`grid size-11 place-items-center rounded-lg text-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${n <= rating ? "text-gold" : "text-muted-foreground"}`}
              >
                ★
              </span>
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
        {ratingError && (
          <p id={`${bookingId}-rating-error`} role="alert" className="text-sm text-destructive">
            {ratingError}
          </p>
        )}
      </fieldset>
      <TextAreaField control={asAnyControl(form.control)} name="comment" label="Comment" rows={2} />
      <SubmitButton pending={pending} size="sm" className="w-fit">
        Submit review
      </SubmitButton>
    </form>
  );
}
