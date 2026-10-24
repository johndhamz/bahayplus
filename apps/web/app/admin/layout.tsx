import { PortalLayout } from "@/components/layout/portal-layout";

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <PortalLayout portal="admin">{children}</PortalLayout>;
}
