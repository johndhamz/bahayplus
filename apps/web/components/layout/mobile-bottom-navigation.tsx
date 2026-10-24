"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { isNavActive, navHref, PORTAL_LABEL, PORTAL_NAV } from "@/lib/config/navigation";
import type { Portal } from "@/lib/config/routes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@bahayplus/ui/components/ui/sheet";
import { SidebarNav } from "./sidebar";

type MobileBottomNavigationProps = {
  portal: Portal;
  basePath: string;
  className?: string;
};

/** Fixed bottom tab bar for mobile-first portals. Secondary items live behind "More". */
export function MobileBottomNavigation({ portal, basePath, className }: MobileBottomNavigationProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const all = PORTAL_NAV[portal].flatMap((s) => s.items);
  const primary = all.filter((i) => i.primary).slice(0, 4);
  const hasMore = all.length > primary.length;
  const moreActive = hasMore && !primary.some((i) => isNavActive(pathname, basePath, i.path));

  return (
    <>
      <nav
        aria-label={`${PORTAL_LABEL[portal]} quick navigation`}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-surface/85 lg:hidden",
          className,
        )}
      >
        <ul className="mx-auto flex max-w-xl items-stretch justify-around">
          {primary.map((item) => {
            const active = isNavActive(pathname, basePath, item.path);
            const Icon = item.icon;
            return (
              <li key={item.path} className="flex-1">
                <Link
                  href={navHref(basePath, item.path)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                    active ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-12 place-items-center rounded-full transition-colors",
                      active && "bg-sage",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          {hasMore && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                  moreActive ? "text-brand" : "text-muted-foreground",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-sage")}>
                  <Ellipsis aria-hidden="true" className="size-5" />
                </span>
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
      {hasMore && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl bg-sidebar text-sidebar-foreground">
            <SheetHeader>
              <SheetTitle className="text-sidebar-foreground">More</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <SidebarNav portal={portal} basePath={basePath} onNavigate={() => setMoreOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
