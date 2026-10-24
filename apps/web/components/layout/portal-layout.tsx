import type { ReactNode } from "react";
import { PORTAL_HOME, type Portal } from "@/lib/config/routes";
import { requireUser } from "@/lib/auth/session";
import { AppShell } from "./app-shell";
import { UserMenu } from "./user-menu";

const LAYOUT: Record<Portal, "mobile-first" | "desktop-first"> = {
  app: "mobile-first",
  worker: "mobile-first",
  provider: "desktop-first",
  supplier: "desktop-first",
  admin: "desktop-first",
};

/** Server-side authenticated shell shared by all five portals. */
export async function PortalLayout({ portal, children }: { portal: Portal; children: ReactNode }) {
  const user = await requireUser(PORTAL_HOME[portal]);
  const displayName = user.email?.split("@")[0] ?? "Account";
  return (
    <AppShell
      portal={portal}
      basePath={PORTAL_HOME[portal]}
      layout={LAYOUT[portal]}
      actions={<UserMenu displayName={displayName} email={user.email} />}
    >
      {children}
    </AppShell>
  );
}
