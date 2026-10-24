import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@bahayplus/ui/components/ui/button";

type SubmitButtonProps = ComponentProps<typeof Button> & { pending: boolean; pendingLabel?: string };

export function SubmitButton({ pending, pendingLabel, children, disabled, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
