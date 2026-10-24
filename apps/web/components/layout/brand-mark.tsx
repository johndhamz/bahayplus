import Link from "next/link";
import { cn } from "@bahayplus/ui/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  /** "light" for dark backgrounds (sidebar), "dark" for light backgrounds. */
  tone?: "light" | "dark";
  showWordmark?: boolean;
};

export function BrandMark({ href = "/", className, tone = "dark", showWordmark = true }: BrandMarkProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 rounded-md font-heading text-lg font-bold", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-9 place-items-center rounded-xl text-base font-extrabold",
          tone === "light" ? "bg-gold text-brand" : "bg-brand text-gold",
        )}
      >
        B+
      </span>
      {!showWordmark && <span className="sr-only">Bahay+</span>}
      {showWordmark && (
        <span className={tone === "light" ? "text-white" : "text-brand"}>
          Bahay<span className={tone === "light" ? "text-gold" : "text-terracotta"}>+</span>
        </span>
      )}
    </Link>
  );
}
