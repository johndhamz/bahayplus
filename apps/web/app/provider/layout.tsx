import { PortalLayout } from "@/components/layout/portal-layout";

export default function Layout({ children }: LayoutProps<"/provider">) {
  return <PortalLayout portal="provider">{children}</PortalLayout>;
}
