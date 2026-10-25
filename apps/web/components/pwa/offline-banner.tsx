"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** Announces lost connectivity; forms keep the user's input and can be resubmitted when back online. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sm text-background"
    >
      <WifiOff aria-hidden="true" className="size-4" /> You&apos;re offline. Changes can&apos;t be saved until you
      reconnect.
    </div>
  );
}
