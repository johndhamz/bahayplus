import { requireUser } from "@/lib/auth/session";

/** Customer portal: authentication gate only. The shell is rendered per household under /app/h/[householdId]. */
export default async function Layout({ children }: LayoutProps<"/app">) {
  await requireUser("/app");
  return children;
}
