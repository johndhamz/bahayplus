import { PortalLayout } from "@/components/layout/portal-layout";

export default function Layout({ children }: LayoutProps<"/supplier">) {
  return <PortalLayout portal="supplier">{children}</PortalLayout>;
}
