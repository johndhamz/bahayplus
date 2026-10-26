import { useId } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { SITE } from "@/lib/config/site";

/**
 * Bahay+ brand system (docs/brand.md). The mark is drawn as SVG from the brand sheet's proportions so it
 * stays crisp at every size and can follow light/dark surfaces; the wordmark is live text in the heading
 * font (Plus Jakarta Sans 800, lowercase "bahay" + accent "+").
 */
export type LogoTone =
  /** Light surfaces: gold house, green cross, green wordmark. */
  | "brand"
  /** Dark/green surfaces: gold house, white cross, white wordmark. */
  | "inverse"
  /** One-colour on light surfaces. */
  | "mono-dark"
  /** One-colour on dark surfaces. */
  | "mono-light";

const CROSS: Record<LogoTone, string> = {
  brand: "var(--brand)",
  inverse: "#ffffff",
  "mono-dark": "currentColor",
  "mono-light": "#ffffff",
};

/** The house-and-plus mark. Decorative by default (the wordmark or a label carries the name). */
export function LogoMark({
  tone = "brand",
  className,
  title,
}: {
  tone?: LogoTone;
  className?: string;
  title?: string;
}) {
  const id = useId();
  const gradient = `bp-gold-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const mono = tone === "mono-dark" || tone === "mono-light";
  const houseStroke = mono ? (tone === "mono-light" ? "#ffffff" : "currentColor") : `url(#${gradient})`;
  return (
    <svg
      viewBox="0 0 100 95"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {!mono && (
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F3DDA6" />
            <stop offset="0.55" stopColor="#E5C584" />
            <stop offset="1" stopColor="#D8A65C" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M50 5.6 L90.5 35.4 Q94.4 38.3 94.4 43 V81 Q94.4 89 86.4 89 H13.6 Q5.6 89 5.6 81 V43 Q5.6 38.3 9.5 35.4 Z"
        fill="none"
        stroke={houseStroke}
        strokeWidth="11"
        strokeLinejoin="round"
      />
      <rect x="26.4" y="48.9" width="47.2" height="13" rx="6.5" fill={CROSS[tone]} />
      <rect x="43.5" y="31.8" width="13" height="47.2" rx="6.5" fill={CROSS[tone]} />
    </svg>
  );
}

/** App-icon style tile (primary app icon): gold mark on brand green. */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-[28%] bg-brand", className)}>
      <LogoMark tone="inverse" className="w-[62%]" />
    </span>
  );
}

const WORD: Record<LogoTone, string> = {
  brand: "text-brand",
  inverse: "text-white",
  "mono-dark": "text-current",
  "mono-light": "text-white",
};
const PLUS: Record<LogoTone, string> = {
  brand: "text-gold",
  inverse: "text-gold",
  "mono-dark": "text-current",
  "mono-light": "text-white",
};
const TAGLINE: Record<LogoTone, string> = {
  brand: "text-brand",
  inverse: "text-white/90",
  "mono-dark": "text-current",
  "mono-light": "text-white/90",
};

/** "bahay+" wordmark. Screen readers hear "Bahay+". */
export function Wordmark({ tone = "brand", className }: { tone?: LogoTone; className?: string }) {
  return (
    <span
      className={cn("font-heading leading-none font-extrabold tracking-[-0.035em] lowercase", WORD[tone], className)}
    >
      <span aria-hidden="true">
        bahay<span className={PLUS[tone]}>+</span>
      </span>
      <span className="sr-only">Bahay+</span>
    </span>
  );
}

/**
 * Full logo. Horizontal is the primary lockup; stacked suits square or narrow spaces.
 * Minimum widths (brand sheet): horizontal 120 px; mark alone 24 px.
 */
export function Logo({
  tone = "brand",
  layout = "horizontal",
  tagline = false,
  size = "md",
  className,
}: {
  tone?: LogoTone;
  layout?: "horizontal" | "stacked";
  tagline?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const scale = {
    sm: { mark: "h-7", word: "text-[1.45rem]", tag: "text-[0.5rem]", gap: "gap-2" },
    md: { mark: "h-9", word: "text-[1.9rem]", tag: "text-[0.6rem]", gap: "gap-2.5" },
    lg: { mark: "h-14", word: "text-5xl", tag: "text-xs", gap: "gap-3.5" },
    xl: { mark: "h-24", word: "text-7xl", tag: "text-base", gap: "gap-5" },
  }[size];
  const taglineEl = tagline && (
    <span
      aria-hidden="true"
      className={cn("font-medium tracking-[0.22em] whitespace-nowrap", scale.tag, TAGLINE[tone])}
    >
      {SITE.tagline}
    </span>
  );
  if (layout === "stacked") {
    return (
      <span className={cn("inline-flex flex-col items-center", scale.gap, className)}>
        <LogoMark tone={tone} className={cn(scale.mark, "w-auto")} />
        <span className="flex flex-col items-center gap-[0.35em]">
          <Wordmark tone={tone} className={scale.word} />
          {taglineEl}
        </span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center", scale.gap, className)}>
      <LogoMark tone={tone} className={cn(scale.mark, "w-auto")} />
      <span className="flex flex-col gap-[0.3em]">
        <Wordmark tone={tone} className={scale.word} />
        {taglineEl}
      </span>
    </span>
  );
}
