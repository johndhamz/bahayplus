import { getPlatformSettings } from "@bahayplus/modules/admin";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { SettingField } from "@/components/admin/admin-forms";
import { adminContext } from "@/components/admin/admin-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  const { ctx, can } = await adminContext("platform.access");
  const settings = await getPlatformSettings(ctx);
  if (!settings.ok) return <ErrorState description="We couldn't load settings." />;
  const s = settings.value;
  const editable = can("platform.settings.manage");
  return (
    <>
      <PageHeader
        title="Platform settings"
        description={
          editable
            ? "Changes take effect immediately and are recorded in the audit log."
            : "Only super admins can change these."
        }
      />
      <SectionCard title="Settings" id="settings" className="max-w-2xl">
        {editable ? (
          <div className="flex flex-col gap-5">
            <SettingField
              settingKey="maintenance_banner"
              label="Maintenance banner"
              initial={s.maintenanceBanner}
              help="Shown at the top of every portal. Leave empty to hide."
            />
            <SettingField
              settingKey="urgent_stale_hours"
              label="Availability is stale after (hours)"
              initial={String(s.urgentStaleHours)}
              type="number"
              help="Urgent discovery flags provider availability older than this."
            />
            <SettingField settingKey="support_email" label="Support email" initial={s.supportEmail} type="email" />
          </div>
        ) : (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Maintenance banner</dt>
              <dd>{s.maintenanceBanner || "Hidden"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Availability stale after</dt>
              <dd>{s.urgentStaleHours} hours</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Support email</dt>
              <dd>{s.supportEmail}</dd>
            </div>
          </dl>
        )}
      </SectionCard>
    </>
  );
}
