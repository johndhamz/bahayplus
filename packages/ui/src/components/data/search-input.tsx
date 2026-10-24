"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@bahayplus/ui/lib/utils";

type SearchInputProps = {
  label: string;
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Debounced callback. When omitted, the input works as a plain GET form field. */
  onValueChange?: (value: string) => void;
  debounceMs?: number;
  /** Show the label visually (otherwise it is screen-reader only). */
  showLabel?: boolean;
  className?: string;
};

export function SearchInput({
  label,
  name = "q",
  placeholder = "Search",
  defaultValue = "",
  onValueChange,
  debounceMs = 300,
  showLabel = false,
  className,
}: SearchInputProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const callback = useRef(onValueChange);
  const first = useRef(true);

  useEffect(() => {
    callback.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!callback.current) return;
    const handle = setTimeout(() => callback.current?.(value.trim()), debounceMs);
    return () => clearTimeout(handle);
  }, [value, debounceMs]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium", !showLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          type="search"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 w-full rounded-xl border border-input bg-surface pr-10 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              if (callback.current) callback.current("");
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
