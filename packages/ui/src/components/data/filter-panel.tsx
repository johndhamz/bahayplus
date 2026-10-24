"use client";

import { ChevronDown, ListFilter } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { Button } from "@bahayplus/ui/components/ui/button";

export type FilterOption = { value: string; label: string; count?: number };
export type FilterGroup = {
  id: string;
  label: string;
  type: "checkbox" | "radio";
  options: FilterOption[];
};
export type FilterValues = Record<string, string[]>;

type FilterPanelProps = {
  groups: FilterGroup[];
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  onReset?: () => void;
  title?: string;
  className?: string;
};

export function countActiveFilters(value: FilterValues): number {
  return Object.values(value).reduce((n, v) => n + v.length, 0);
}

/** Filter groups rendered as fieldsets. Collapsible on small screens, always open from `lg`. */
export function FilterPanel({ groups, value, onChange, onReset, title = "Filters", className }: FilterPanelProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(value);

  const toggle = (group: FilterGroup, optionValue: string, checked: boolean) => {
    const current = value[group.id] ?? [];
    const next =
      group.type === "radio"
        ? checked
          ? [optionValue]
          : []
        : checked
          ? [...current, optionValue]
          : current.filter((v) => v !== optionValue);
    onChange({ ...value, [group.id]: next });
  };

  return (
    <section aria-label={title} className={cn("rounded-2xl border border-border bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 font-heading font-semibold lg:pointer-events-none"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          <ListFilter aria-hidden="true" className="size-4" />
          {title}
          {active > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
              {active}
              <span className="sr-only"> active</span>
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform lg:hidden", open && "rotate-180")}
          />
        </button>
        {onReset && active > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear all
          </Button>
        )}
      </div>
      <div id={panelId} className={cn("mt-3 flex-col gap-5", open ? "flex" : "hidden lg:flex")}>
        {groups.map((group) => (
          <fieldset key={group.id} className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold text-foreground">{group.label}</legend>
            {group.options.map((option) => {
              const checked = (value[group.id] ?? []).includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
                >
                  <input
                    type={group.type}
                    name={`${panelId}-${group.id}`}
                    value={option.value}
                    checked={checked}
                    onChange={(e) => toggle(group, option.value, e.target.checked)}
                    className="size-4 accent-[var(--brand)]"
                  />
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
