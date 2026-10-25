"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PreferenceMatrix } from "@bahayplus/modules/notifications";
import { Button } from "@bahayplus/ui/components/ui/button";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@bahayplus/validation/notifications/notifications";
import { updateNotificationPreferencesAction } from "@/lib/actions/notifications";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  bills: "Bills & utilities",
  assets: "Home assets & warranties",
  pets: "Pet care",
  vehicles: "Vehicles",
  bookings: "Bookings & quotations",
  projects: "Renovation projects",
  account: "Account & security",
};

export function PreferencesForm({ initial, emailAvailable }: { initial: PreferenceMatrix; emailAvailable: boolean }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();
  const toggle = (c: NotificationCategory, ch: "in_app" | "email") =>
    setPrefs((p) => ({ ...p, [c]: { ...p[c], [ch]: !p[c][ch] } }));
  const save = () =>
    start(async () => {
      const r = await updateNotificationPreferencesAction({
        preferences: NOTIFICATION_CATEGORIES.flatMap((c) => [
          { category: c, channel: "in_app", enabled: prefs[c].in_app },
          { category: c, channel: "email", enabled: prefs[c].email },
        ]),
      });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success("Notification settings saved.");
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-4">
      <div
        className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card"
        tabIndex={0}
        role="group"
        aria-label="Scrollable table"
      >
        <table className="w-full min-w-[480px] text-sm">
          <caption className="sr-only">Notification channels by category</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
              <th scope="col" className="p-3 font-semibold">
                Category
              </th>
              <th scope="col" className="p-3 text-center font-semibold">
                In-app
              </th>
              <th scope="col" className="p-3 text-center font-semibold">
                Email
              </th>
              <th scope="col" className="p-3 text-center font-semibold">
                SMS
              </th>
              <th scope="col" className="p-3 text-center font-semibold">
                Push
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NOTIFICATION_CATEGORIES.map((c) => (
              <tr key={c}>
                <th scope="row" className="p-3 text-left font-medium">
                  {CATEGORY_LABELS[c]}
                </th>
                {(["in_app", "email"] as const).map((ch) => (
                  <td key={ch} className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--brand)]"
                      aria-label={`${CATEGORY_LABELS[c]}: ${ch === "in_app" ? "in-app" : "email"}`}
                      checked={prefs[c][ch]}
                      onChange={() => toggle(c, ch)}
                    />
                  </td>
                ))}
                <td className="p-3 text-center text-xs text-muted-foreground">Not available</td>
                <td className="p-3 text-center text-xs text-muted-foreground">Not available</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!emailAvailable && (
        <p role="note" className="text-sm text-muted-foreground">
          Email delivery isn&apos;t set up on this server yet, so email notifications are recorded but not sent.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        SMS and push notifications will be offered once a delivery provider is connected. Nothing is sent by SMS or push
        today.
      </p>
      <Button onClick={save} disabled={pending} className="w-fit">
        Save settings
      </Button>
    </div>
  );
}
