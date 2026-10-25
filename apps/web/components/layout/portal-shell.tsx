import type { ReactNode } from "react";
import type { Portal } from "@/lib/config/routes";
import { getPlatformSettings } from "@bahayplus/modules/admin";
import { countUnread } from "@bahayplus/modules/notifications";
import { getMyContexts, getServiceContext } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/session";
import { AppShell } from "./app-shell";
import { NotificationBell } from "./notification-bell";
import { UserMenu, type PortalLink } from "./user-menu";

const LAYOUT: Record<Portal, "mobile-first" | "desktop-first"> = {
  app: "mobile-first",
  worker: "mobile-first",
  provider: "desktop-first",
  supplier: "desktop-first",
  admin: "desktop-first",
};

/** Portals the user can reach, derived from their memberships (never from a global role). */
export async function portalLinks(): Promise<PortalLink[]> {
  const contexts = await getMyContexts();
  const links: PortalLink[] = [{ href: "/app", label: "Home (household)" }];
  if (contexts.some((c) => c.kind === "organization" && c.orgKind === "service_provider" && c.roleKey !== "worker"))
    links.push({ href: "/provider", label: "Provider portal" });
  if (contexts.some((c) => c.kind === "organization" && c.orgKind === "supplier"))
    links.push({ href: "/supplier", label: "Supplier portal" });
  if (contexts.some((c) => c.kind === "organization" && c.roleKey === "worker"))
    links.push({ href: "/worker", label: "Field worker" });
  if (contexts.some((c) => c.kind === "platform")) links.push({ href: "/admin", label: "Platform admin" });
  return links;
}

type PortalShellProps = { portal: Portal; basePath: string; context?: ReactNode; children: ReactNode };

/** Authenticated shell shared by all five portals. Authorization of the context happens in the caller. */
export async function PortalShell({ portal, basePath, context, children }: PortalShellProps) {
  const user = await requireUser(basePath);
  const links = await portalLinks();
  const displayName = user.email?.split("@")[0] ?? "Account";
  const ctx = await getServiceContext();
  const [unread, settings] = ctx ? await Promise.all([countUnread(ctx), getPlatformSettings(ctx)]) : [0, null];
  const banner = settings?.ok ? settings.value.maintenanceBanner : "";
  return (
    <AppShell
      portal={portal}
      basePath={basePath}
      layout={LAYOUT[portal]}
      context={context}
      actions={
        <>
          <NotificationBell unread={unread} />
          <UserMenu displayName={displayName} email={user.email} portals={links} />
        </>
      }
    >
      {banner && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-2 text-sm font-medium"
        >
          {banner}
        </p>
      )}
      {children}
    </AppShell>
  );
}
