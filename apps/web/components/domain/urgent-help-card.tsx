import { Phone, Siren } from "lucide-react";
import Link from "next/link";
import { SITE } from "@/lib/config/site";
import { cn } from "@bahayplus/ui/lib/utils";

/**
 * Entry point to urgent provider discovery. Always carries the emergency disclaimer:
 * Bahay+ does not dispatch emergency services or guarantee response times.
 */
export function UrgentHelpCard({ href, className }: { href: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl bg-brand p-4 text-brand-foreground sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-terracotta text-white">
          <Siren aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="font-heading text-lg font-semibold">Need help fast?</p>
          <p className="text-sm text-brand-foreground/85">
            Find available providers for urgent plumbing, electrical, locksmith and roadside problems.
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gold px-4 text-sm font-semibold text-brand hover:bg-gold/90"
      >
        Find urgent help
      </Link>
      <p className="flex items-start gap-2 rounded-lg bg-white/10 p-2.5 text-xs text-brand-foreground/90">
        <Phone aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Life-threatening emergency, fire or crime? Call <strong>{SITE.emergencyHotline}</strong> now. Bahay+ does not
          dispatch emergency services or guarantee response times.
        </span>
      </p>
    </div>
  );
}
