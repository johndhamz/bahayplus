import { getPreferences } from "@bahayplus/modules/notifications";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { AccountFrame } from "@/components/account/account-frame";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { requireServiceContext } from "@/lib/auth/context";
import { emailAdapter } from "@/lib/notifications/adapters";

export const metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const ctx = await requireServiceContext("/account/notifications/settings");
  const prefs = await getPreferences(ctx);
  return (
    <AccountFrame title="Notification settings" description="Choose how Bahay+ reaches you for each kind of update.">
      {prefs.ok ? (
        <PreferencesForm initial={prefs.value} emailAvailable={emailAdapter() !== null} />
      ) : (
        <ErrorState description="We couldn't load your settings." />
      )}
    </AccountFrame>
  );
}
