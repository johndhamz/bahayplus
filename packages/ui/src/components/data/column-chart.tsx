"use client";

import { useId, useState } from "react";
import { formatPesoCompact } from "@bahayplus/types/money";
import { cn } from "@bahayplus/ui/lib/utils";

export type ColumnDatum = { key: string; label: string; value: number; display: string };

type ColumnChartProps = {
  /** Accessible title; also names the single series (no legend box for one series). */
  title: string;
  data: ColumnDatum[];
  /** Axis tick format (a name, not a function, so the chart can be rendered from Server Components). */
  valueFormat: "peso" | "number";
  /** Index of the column to label directly (defaults to the last). */
  labelIndex?: number;
  height?: number;
  className?: string;
};

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= max / 4)! * magnitude;
  return Math.ceil(max / step) * step;
}

/**
 * Single-series column chart: thin capped columns with 4px rounded data-ends square at the
 * baseline, hairline grid, one direct label, hover/focus tooltip per column, and a table view.
 */
export function ColumnChart({ title, data, valueFormat, labelIndex, height = 200, className }: ColumnChartProps) {
  const formatTick = (v: number) =>
    valueFormat === "peso"
      ? formatPesoCompact(Math.round(v))
      : new Intl.NumberFormat("en-PH", { notation: "compact" }).format(v);
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const width = 560;
  const pad = { top: 24, right: 8, bottom: 28, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, band * 0.6);
  const labelAt = labelIndex ?? data.length - 1;
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;

  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-labelledby={`${id}-title`}>
      <div className="flex items-center justify-between gap-2">
        <figcaption id={`${id}-title`} className="text-sm font-semibold text-foreground">
          {title}
        </figcaption>
        <button
          type="button"
          className="min-h-10 rounded-md px-2 text-sm font-medium text-brand hover:underline dark:text-primary"
          aria-expanded={showTable}
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {showTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="py-1 font-medium">
                Month
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-border">
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right tabular-nums">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={`${title}. Use “Show table” for exact values.`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                <text
                  x={pad.left - 8}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.left + band * i + band / 2;
              const top = y(d.value);
              const h = pad.top + plotH - top;
              const r = Math.min(4, h, barW / 2);
              const x0 = cx - barW / 2;
              const base = pad.top + plotH;
              // Rounded data-end, square at the baseline.
              const path =
                h <= 0
                  ? ""
                  : `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`;
              return (
                <g key={d.key}>
                  {path && <path d={path} fill="var(--brand)" opacity={active === null || active === i ? 1 : 0.55} />}
                  <text x={cx} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {d.label}
                  </text>
                  {i === labelAt && d.value > 0 && (
                    <text x={cx} y={top - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                      {d.display}
                    </text>
                  )}
                  {/* Hit target larger than the mark (full band height and width). */}
                  <rect
                    x={pad.left + band * i}
                    y={pad.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.label}: ${d.display}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="cursor-default outline-none focus-visible:stroke-ring"
                    strokeWidth={2}
                  />
                </g>
              );
            })}
          </svg>
          {active !== null && data[active] && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{
                left: `${((pad.left + band * active + band / 2) / width) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              <span className="block text-muted-foreground">{data[active].label}</span>
              <span className="font-semibold text-foreground tabular-nums">{data[active].display}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
