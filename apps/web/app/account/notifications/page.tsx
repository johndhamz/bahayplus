import { Bell } from "lucide-react";
import Link from "next/link";
import { listNotifications, type NotificationView } from "@bahayplus/modules/notifications";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { cn } from "@bahayplus/ui/lib/utils";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { AccountFrame } from "@/components/account/account-frame";
import { MarkAllReadButton, OpenNotification } from "@/components/notifications/notification-actions";
import { requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Notifications" };

const CHANNEL_LABEL = { email: "Email", sms: "SMS", push: "Push" } as const;

function deliveryLabel(d: NotificationView["deliveries"][number]): string | null {
  if (d.channel === "in_app") return null;
  const ch = CHANNEL_LABEL[d.channel];
  switch (d.status) {
    case "sent":
      return `${ch} sent`;
    case "queued":
    case "sending":
      return `${ch} pending`;
    case "failed":
      return `${ch} failed`;
    case "cancelled":
      return `${ch} cancelled`;
    case "skipped":
      return d.skipReason === "channel_not_configured" ? `${ch} not available` : null;
  }
}

export default async function NotificationsPage({ searchParams }: PageProps<"/account/notifications">) {
  const sp = await searchParams;
  const unreadOnly = sp.filter === "unread";
  const ctx = await requireServiceContext("/account/notifications");
  const result = await listNotifications(ctx, { unreadOnly, limit: 100 });
  const items = result.ok ? result.value : [];
  const hasUnread = items.some((n) => !n.readAt);
  return (
    <AccountFrame
      title="Notifications"
      description="Reminders and updates from your households and businesses."
      actions={
        <div className="flex gap-2">
          <Link
            href="/account/notifications/settings"
            className="inline-flex min-h-10 items-center px-2 text-sm font-medium text-brand hover:underline"
          >
            Settings
          </Link>
          <MarkAllReadButton disabled={!hasUnread} />
        </div>
      }
    >
      <nav aria-label="Filter notifications" className="flex gap-2">
        {[
          ["All", "/account/notifications", !unreadOnly],
          ["Unread", "/account/notifications?filter=unread", unreadOnly],
        ].map(([label, href, active]) => (
          <Link
            key={label as string}
            href={href as string}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
              active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface hover:bg-muted",
            )}
          >
            {label as string}
          </Link>
        ))}
      </nav>
      {!result.ok ? (
        <ErrorState description="We couldn't load your notifications." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          titleAs="h2"
          title={unreadOnly ? "You're all caught up" : "No notifications yet"}
          description="Bill reminders, booking updates and maintenance due dates will appear here."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface shadow-card">
          {items.map((n) => {
            const chips = n.deliveries.map(deliveryLabel).filter(Boolean);
            return (
              <li key={n.id} className={cn("flex gap-3 p-4", !n.readAt && "bg-sage/40")}>
                <span
                  aria-hidden="true"
                  className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-terracotta")}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {!n.readAt && <span className="sr-only">Unread: </span>}
                    <OpenNotification id={n.id} href={n.link} title={n.title} unread={!n.readAt} />
                  </p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatManilaDateTime(n.createdAt)}
                    {chips.length ? ` · ${chips.join(" · ")}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AccountFrame>
  );
}
