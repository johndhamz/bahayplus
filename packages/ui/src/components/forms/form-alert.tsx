import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@bahayplus/ui/lib/utils";

export function FormAlert({
  message,
  tone = "error",
  className,
}: {
  message: string | null | undefined;
  tone?: "error" | "success";
  className?: string;
}) {
  if (!message) return null;
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
        tone === "error" ? "bg-danger-soft text-destructive" : "bg-success-soft text-success",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
