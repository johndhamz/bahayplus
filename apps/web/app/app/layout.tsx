import { PortalLayout } from "@/components/layout/portal-layout";

export default function Layout({ children }: LayoutProps<"/app">) {
  return <PortalLayout portal="app">{children}</PortalLayout>;
}
