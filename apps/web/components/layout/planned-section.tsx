import { Construction } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { navHref, PORTAL_NAV } from "@/lib/config/navigation";
import type { Portal } from "@/lib/config/routes";
import { PageHeader } from "./page-header";

/**
 * Placeholder for navigation destinations whose feature phase hasn't shipped yet.
 * Unknown paths still 404 — only sections declared in the portal navigation render here.
 */
export async function PlannedSection({
  portal,
  basePath,
  section,
}: {
  portal: Portal;
  basePath: string;
  section: string[];
}) {
  const path = section.join("/");
  const item = PORTAL_NAV[portal].flatMap((s) => s.items).find((i) => i.path === path);
  if (!item) notFound();
  return (
    <>
      <PageHeader
        title={item.label}
        breadcrumbs={[{ label: "Home", href: navHref(basePath, "") }, { label: item.label }]}
      />
      <EmptyState
        icon={Construction}
        title={`${item.label} isn't available yet`}
        description="This area is part of an upcoming Bahay+ release. Nothing here is hidden or lost."
        action={
          <Button asChild variant="outline">
            <Link href={basePath}>Back to dashboard</Link>
          </Button>
        }
      />
    </>
  );
}
