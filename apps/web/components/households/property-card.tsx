import { Building2, Home, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { formatPhilippineAddress, PROPERTY_TYPE_LABELS, type PropertyView } from "@bahayplus/modules/properties";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { cn } from "@bahayplus/ui/lib/utils";

export function PropertyCard({
  property,
  href,
  className,
}: {
  property: PropertyView;
  href: string;
  className?: string;
}) {
  const address = formatPhilippineAddress(property);
  const Icon = property.propertyType === "house" || property.propertyType === "townhouse" ? Home : Building2;
  return (
    <Link
      href={href}
      className={cn(
        "flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-brand/40",
        property.archivedAt && "opacity-75",
        className,
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage text-brand">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-heading font-semibold">{property.name}</span>
          {property.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              <Star aria-hidden="true" className="size-3" /> Default
            </span>
          )}
          {property.archivedAt ? (
            <StatusBadge status="archived" />
          ) : (
            !property.isActive && <StatusBadge status="inactive" />
          )}
        </span>
        <span className="block text-xs text-terracotta-strong">{PROPERTY_TYPE_LABELS[property.propertyType]}</span>
        {address && (
          <span className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{address}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
