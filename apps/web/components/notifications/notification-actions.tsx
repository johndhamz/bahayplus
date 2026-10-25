"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@bahayplus/ui/components/ui/button";
import { markNotificationsReadAction } from "@/lib/actions/notifications";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await markNotificationsReadAction({ all: true });
          if (!r.ok) return void toast.error(r.error.message);
          router.refresh();
        })
      }
    >
      Mark all as read
    </Button>
  );
}

/** Opens a notification's link and marks it read. */
export function OpenNotification({
  id,
  href,
  title,
  unread,
}: {
  id: string;
  href: string | null;
  title: string;
  unread: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = () =>
    start(async () => {
      if (unread) await markNotificationsReadAction({ notificationIds: [id] });
      if (href) router.push(href);
      else router.refresh();
    });
  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="text-left font-medium hover:underline disabled:opacity-60"
    >
      {title}
    </button>
  );
}
