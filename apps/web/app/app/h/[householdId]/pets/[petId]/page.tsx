import { Lock, PawPrint } from "lucide-react";
import { notFound } from "next/navigation";
import { listFiles } from "@bahayplus/modules/files";
import {
  getPet,
  listPetHealthRecords,
  petAge,
  PET_HEALTH_KIND_LABELS,
  PET_SPECIES_LABELS,
} from "@bahayplus/modules/pets";
import { listDueItems } from "@bahayplus/modules/scheduling";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { ArchiveToggle } from "@/components/registry/archive-toggle";
import { AttachmentList } from "@/components/registry/attachment-list";
import { DueList } from "@/components/registry/due-list";
import { FileUpload } from "@/components/registry/file-upload";
import { EditPetForm, PetHealthRecordForm } from "@/components/registry/pet-forms";
import { RecordTimeline } from "@/components/registry/record-timeline";
import { archivePetAction, deletePetHealthRecordAction, restorePetAction } from "@/lib/actions/registry";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Pet" };

export default async function PetPage({ params }: PageProps<"/app/h/[householdId]/pets/[petId]">) {
  const { householdId, petId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getPet(ctx, petId);
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const pet = result.value;
  const today = manilaDateOf(new Date());
  const canSeeHealth = access.permissions.has("pet.health.view");
  const [records, photos, due] = await Promise.all([
    listPetHealthRecords(ctx, petId),
    listFiles(ctx, "pet", petId),
    listDueItems(ctx, householdId, { horizonDays: 3650, subject: { type: "pet", id: petId } }),
  ]);
  const canManage = access.permissions.has("registry.manage") && !pet.archivedAt;
  const canManageHealth = access.permissions.has("pet.health.manage") && !pet.archivedAt;
  const photo = photos.ok ? photos.value.find((f) => f.id === pet.photoFileId) : undefined;
  const base = `/app/h/${householdId}`;
  const all = records.ok ? records.value : [];
  const toItem = (r: (typeof all)[number]) => ({
    id: r.id,
    date: formatManilaDate(r.occurredOn),
    title: `${PET_HEALTH_KIND_LABELS[r.kind]}: ${r.title}`,
    detail: [r.clinicOrProvider, r.notes].filter(Boolean).join(" — ") || undefined,
    meta:
      [
        r.nextDueOn && `Next due ${formatManilaDate(r.nextDueOn)}`,
        r.costCentavos !== null && formatPeso(r.costCentavos),
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
  });

  return (
    <>
      <PageHeader
        title={pet.name}
        eyebrow={[PET_SPECIES_LABELS[pet.species], pet.breed, petAge(pet.birthDate, today)].filter(Boolean).join(" · ")}
        breadcrumbs={[{ label: "Home", href: base }, { label: "Pets", href: `${base}/pets` }, { label: pet.name }]}
        actions={
          access.permissions.has("registry.manage") ? (
            <ArchiveToggle
              archived={!!pet.archivedAt}
              label={pet.name}
              description="Use this if your pet has passed away or been rehomed. Records are kept."
              archive={archivePetAction.bind(null, { petId })}
              restore={restorePetAction.bind(null, { petId })}
            />
          ) : undefined
        }
      />
      {pet.archivedAt && <StatusBadge status="archived" className="mb-4" />}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Health & care records" id="health">
            {!canSeeHealth && (
              <p className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                <Lock aria-hidden="true" className="size-4" /> Veterinary records are private to household owners,
                managers and members. You can see grooming history.
              </p>
            )}
            {(canManageHealth || canManage) && (
              <PetHealthRecordForm petId={petId} today={today} allowSensitive={canManageHealth} />
            )}
            <RecordTimeline
              empty="No records yet."
              deleteAction={canManageHealth ? deletePetHealthRecordAction : undefined}
              items={all.map(toItem)}
            />
          </SectionCard>
          <SectionCard title="Profile" id="profile">
            {canManage ? (
              <EditPetForm pet={pet} />
            ) : (
              <dl className="grid gap-2 text-sm">
                {pet.carePreferences && (
                  <div>
                    <dt className="text-muted-foreground">Care preferences</dt>
                    <dd className="whitespace-pre-line">{pet.carePreferences}</dd>
                  </div>
                )}
              </dl>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="Photo" id="photo">
            {photo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img
                src={photo.url}
                alt={`Photo of ${pet.name}`}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ) : (
              <div className="grid aspect-square place-items-center rounded-xl bg-sage text-brand">
                <PawPrint aria-hidden="true" className="size-16" />
              </div>
            )}
            {canManage && (
              <FileUpload
                householdId={householdId}
                entityType="pet"
                entityId={petId}
                purpose="photo"
                label="Upload photo"
                imagesOnly
                setAsPetPhoto={petId}
              />
            )}
          </SectionCard>
          <SectionCard title="Reminders" id="reminders">
            <DueList
              items={due.ok ? due.value : []}
              basePath={base}
              emptyText="Add a next-due date to vaccinations or grooming to get reminders."
            />
          </SectionCard>
          {photos.ok && photos.value.length > 1 && (
            <SectionCard title="Files" id="files">
              <AttachmentList files={photos.value} canManage={canManage} />
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
