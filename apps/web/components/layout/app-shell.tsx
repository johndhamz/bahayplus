import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import type { Portal } from "@/lib/config/routes";
import { Header } from "./header";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  portal: Portal;
  /** Context base path, e.g. "/app" or later "/app/h/{householdId}". */
  basePath: string;
  /**
   * "mobile-first": bottom tab bar on small screens (customer, worker).
   * "desktop-first": slide-out menu on small screens (provider, supplier, admin).
   */
  layout: "mobile-first" | "desktop-first";
  context?: ReactNode;
  actions?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

export function AppShell({ portal, basePath, layout, context, actions, sidebarFooter, children }: AppShellProps) {
  const mobileFirst = layout === "mobile-first";
  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-brand px-4 py-2 text-brand-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Sidebar portal={portal} basePath={basePath} footer={sidebarFooter} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header portal={portal} basePath={basePath} context={context} actions={actions} mobileMenu={!mobileFirst} />
        <main
          id="main-content"
          tabIndex={-1}
          data-portal={portal}
          className={cn(
            "mx-auto w-full flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-8",
            mobileFirst ? "max-w-5xl pb-28 lg:pb-8" : "max-w-7xl",
          )}
        >
          {children}
        </main>
      </div>
      {mobileFirst && <MobileBottomNavigation portal={portal} basePath={basePath} />}
    </div>
  );
}
