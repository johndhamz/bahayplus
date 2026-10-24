"use client";

import { Building2, Check, ChevronsUpDown, House, Plus, Store } from "lucide-react";
import Link from "next/link";
import { Button } from "@bahayplus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bahayplus/ui/components/ui/dropdown-menu";
import { cn } from "@bahayplus/ui/lib/utils";

export type ContextOption = { id: string; name: string; roleLabel: string; href: string };

type ContextSwitcherProps = {
  kind: "household" | "service_provider" | "supplier";
  current: { id: string; name: string; roleLabel: string };
  options: ContextOption[];
  create?: { href: string; label: string };
  className?: string;
};

const ICON = { household: House, service_provider: Building2, supplier: Store } as const;
const HEADING = {
  household: "Your households",
  service_provider: "Your businesses",
  supplier: "Your supplier accounts",
} as const;

/**
 * Switches the tenant context. The context lives in the URL, so switching is a plain navigation and
 * every target is re-authorized on the server; nothing is trusted from this menu.
 */
export function ContextSwitcher({ kind, current, options, create, className }: ContextSwitcherProps) {
  const Icon = ICON[kind];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-11 max-w-full justify-start gap-2 px-2 text-left", className)}
          aria-label={`Current: ${current.name}. Switch ${kind === "household" ? "household" : "business"}`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sage text-brand">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">{current.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{current.roleLabel}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="ml-1 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{HEADING[kind]}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem key={option.id} asChild>
            <Link
              href={option.href}
              aria-current={option.id === current.id ? "true" : undefined}
              className="flex items-center gap-2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{option.name}</span>
                <span className="text-xs text-muted-foreground">{option.roleLabel}</span>
              </span>
              {option.id === current.id && <Check aria-hidden="true" className="size-4 text-brand" />}
            </Link>
          </DropdownMenuItem>
        ))}
        {create && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={create.href}>
                <Plus aria-hidden="true" />
                {create.label}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
