import { PortalShell } from "@/components/layout/portal-shell";
import { requirePlatformAccess } from "@/lib/auth/context";

/** Platform admin portal: only accounts granted a platform role on the server. Others get 404. */
export default async function Layout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAccess();
  return (
    <PortalShell portal="admin" basePath="/admin">
      {children}
    </PortalShell>
  );
}
