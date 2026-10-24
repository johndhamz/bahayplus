import { PortalLayout } from "@/components/layout/portal-layout";

export default function Layout({ children }: LayoutProps<"/worker">) {
  return <PortalLayout portal="worker">{children}</PortalLayout>;
}
