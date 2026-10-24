import { requireUser } from "@/lib/auth/session";

export default async function Layout({ children }: LayoutProps<"/supplier">) {
  await requireUser("/supplier");
  return children;
}
