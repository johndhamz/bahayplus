import { requireUser } from "@/lib/auth/session";

export default async function Layout({ children }: LayoutProps<"/provider">) {
  await requireUser("/provider");
  return children;
}
