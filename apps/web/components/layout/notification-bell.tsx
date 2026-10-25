import { Bell } from "lucide-react";
import Link from "next/link";

/** Header link to the notification inbox with the unread count (server-rendered per request). */
export function NotificationBell({ unread }: { unread: number }) {
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href="/account/notifications"
      aria-label={label}
      className="relative grid size-10 place-items-center rounded-lg text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Bell aria-hidden="true" className="size-5" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] leading-4 font-semibold text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
