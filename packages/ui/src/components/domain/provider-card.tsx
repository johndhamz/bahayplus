import { BadgeCheck, MapPin, ShieldQuestion, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";

export type ProviderVerification =
  | { status: "verified"; /** What was actually checked, e.g. "Business permit", "Government ID". */ items: string[] }
  | { status: "pending" }
  | { status: "unverified" };

type ProviderCardProps = {
  name: string;
  href: string;
  verification: ProviderVerification;
  /** Average rating in tenths (e.g. 47 = 4.7) to avoid float display drift; null when no reviews. */
  rating: { averageTenths: number; count: number } | null;
  categories?: string[];
  serviceArea?: string;
  /** e.g. "Available today" — must reflect real availability data, never assumed. */
  availability?: ReactNode;
  badge?: ReactNode;
  className?: string;
};

export function formatRating(averageTenths: number): string {
  return `${Math.trunc(averageTenths / 10)}.${averageTenths % 10}`;
}

export function ProviderCard({
  name,
  href,
  verification,
  rating,
  categories = [],
  serviceArea,
  availability,
  badge,
  className,
}: ProviderCardProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <article
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card", className)}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand font-heading font-bold text-gold"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading leading-tight font-semibold">
            <Link href={href} className="rounded-sm hover:underline">
              {name}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {rating && rating.count > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star aria-hidden="true" className="size-3.5 fill-gold text-gold" />
                {formatRating(rating.averageTenths)}
                <span className="font-normal text-muted-foreground">
                  ({rating.count} {rating.count === 1 ? "review" : "reviews"})
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">No reviews yet</span>
            )}
            {serviceArea && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin aria-hidden="true" className="size-3.5" />
                {serviceArea}
              </span>
            )}
          </div>
        </div>
        {badge}
      </div>

      {verification.status === "verified" ? (
        <div className="rounded-xl bg-success-soft px-3 py-2 text-xs text-success">
          <p className="inline-flex items-center gap-1 font-semibold">
            <BadgeCheck aria-hidden="true" className="size-4" />
            Verified by Bahay+
          </p>
          {verification.items.length > 0 && <p className="mt-0.5">Checked: {verification.items.join(", ")}</p>}
        </div>
      ) : (
        <p className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          <ShieldQuestion aria-hidden="true" className="size-4" />
          {verification.status === "pending" ? "Verification in review" : "Not yet verified"}
        </p>
      )}

      {categories.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Services offered">
          {categories.map((c) => (
            <li key={c} className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-medium text-sage-foreground">
              {c}
            </li>
          ))}
        </ul>
      )}
      {availability && <div className="text-xs text-muted-foreground">{availability}</div>}
    </article>
  );
}
