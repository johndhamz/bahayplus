import Link from "next/link";
import { cn } from "@bahayplus/ui/lib/utils";
import { Logo, LogoMark, LogoTile } from "@/components/brand/logo";

type BrandMarkProps = {
  href?: string;
  className?: string;
  /** "light" for dark backgrounds (sidebar, brand panels), "dark" for light backgrounds. */
  tone?: "light" | "dark";
  /** False shows only the app-icon tile (e.g. collapsed sidebar, compact headers). */
  showWordmark?: boolean;
};

/** The Bahay+ logo as a home link, used across headers, sidebars and standalone pages. */
export function BrandMark({ href = "/", className, tone = "dark", showWordmark = true }: BrandMarkProps) {
  return (
    <Link href={href} className={cn("inline-flex min-h-10 items-center rounded-md", className)}>
      {showWordmark ? (
        <Logo tone={tone === "light" ? "inverse" : "brand"} size="sm" />
      ) : (
        <>
          {/* On dark surfaces the gold mark stands alone; on light ones it sits in the app-icon tile. */}
          {tone === "light" ? <LogoMark tone="inverse" className="h-8 w-auto" /> : <LogoTile className="size-9" />}
          <span className="sr-only">Bahay+</span>
        </>
      )}
    </Link>
  );
}
