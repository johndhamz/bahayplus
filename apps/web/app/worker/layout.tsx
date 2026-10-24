import { PortalShell } from "@/components/layout/portal-shell";

export default function Layout({ children }: LayoutProps<"/worker">) {
  return (
    <PortalShell portal="worker" basePath="/worker">
      {children}
    </PortalShell>
  );
}
