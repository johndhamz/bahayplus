"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { PORTAL_LABEL } from "@/lib/config/navigation";
import type { Portal } from "@/lib/config/routes";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@bahayplus/ui/components/ui/sheet";
import { BrandMark } from "./brand-mark";
import { SidebarNav } from "./sidebar";

type HeaderProps = {
  portal: Portal;
  basePath: string;
  /** Context switcher (household / organization), shown next to the brand. */
  context?: ReactNode;
  /** Right-aligned actions, e.g. notifications and the user menu. */
  actions?: ReactNode;
  /** Business portals use a slide-out menu on small screens; customer/worker portals use the bottom bar. */
  mobileMenu?: boolean;
  className?: string;
};

export function Header({ portal, basePath, context, actions, mobileMenu = false, className }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6",
        className,
      )}
    >
      {mobileMenu && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 lg:hidden"
          aria-label="Open navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      )}
      <div className="lg:hidden">
        <BrandMark href={basePath} showWordmark={!context} />
      </div>
      {context && <div className="min-w-0 flex-1 lg:flex-none">{context}</div>}
      <div className="ml-auto flex items-center gap-1">{actions}</div>

      {mobileMenu && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="h-16 justify-center px-4">
              <SheetTitle className="sr-only">{PORTAL_LABEL[portal]} menu</SheetTitle>
              <SheetDescription className="sr-only">Navigate the {PORTAL_LABEL[portal]} portal</SheetDescription>
              <BrandMark tone="light" href={basePath} />
            </SheetHeader>
            <div className="overflow-y-auto px-3 pb-6">
              <SidebarNav portal={portal} basePath={basePath} onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}
