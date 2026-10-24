"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { isNavActive, navHref, PORTAL_LABEL, PORTAL_NAV } from "@/lib/config/navigation";
import type { Portal } from "@/lib/config/routes";
import { BrandMark } from "./brand-mark";

const STORAGE_KEY = "bahayplus.sidebar.collapsed";

type SidebarNavProps = {
  portal: Portal;
  basePath: string;
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function SidebarNav({ portal, basePath, collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label={`${PORTAL_LABEL[portal]} navigation`} className="flex flex-col gap-5">
      {PORTAL_NAV[portal].map((section, i) => (
        <div key={section.label ?? i} className="flex flex-col gap-1">
          {section.label && !collapsed && (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
              {section.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isNavActive(pathname, basePath, item.path);
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    href={navHref(basePath, item.path)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "focus-visible:outline-sidebar-ring",
                      active && "bg-sidebar-accent text-sidebar-accent-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn("size-5 shrink-0", active ? "text-sidebar-primary" : "opacity-80")}
                    />
                    <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

type SidebarProps = {
  portal: Portal;
  basePath: string;
  /** Rendered under the brand, e.g. a context switcher. */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Desktop sidebar. Collapsible; preference persists per browser. Hidden below `lg`. */
export function Sidebar({ portal, basePath, header, footer, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Reading a persisted UI preference after hydration avoids a server/client mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !prev;
    });
  };

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[76px]" : "w-64",
        className,
      )}
    >
      <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-2")}>
        <BrandMark tone="light" showWordmark={!collapsed} href={basePath} />
      </div>
      {header && !collapsed && <div className="px-3 pb-3">{header}</div>}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav portal={portal} basePath={basePath} collapsed={collapsed} />
      </div>
      {footer && !collapsed && <div className="border-t border-sidebar-border p-3">{footer}</div>}
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-5" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
