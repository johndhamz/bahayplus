import {
  AddPetHealthRecordInput,
  CreatePetInput,
  PetIdInput,
  SetPetPhotoInput,
  UpdatePetInput,
  type PetHealthKind,
  type PetSpecies,
} from "@bahayplus/validation/registry/pets";
import { RecordIdInput } from "@bahayplus/validation/registry/assets";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type PetView = {
  id: string;
  householdId: string;
  name: string;
  species: PetSpecies;
  breed: string;
  sex: "male" | "female" | "unknown";
  birthDate: string | null;
  colorMarkings: string;
  microchipNumber: string;
  carePreferences: string;
  notes: string;
  photoFileId: string | null;
  archivedAt: string | null;
};

export type PetHealthRecordView = {
  id: string;
  kind: PetHealthKind;
  title: string;
  occurredOn: string;
  nextDueOn: string | null;
  clinicOrProvider: string;
  notes: string;
  costCentavos: number | null;
};

const COLUMNS =
  "id, household_id, name, species, breed, sex, birth_date, color_markings, microchip_number, care_preferences, notes, photo_file_id, archived_at";

type PetRow = {
  id: string;
  household_id: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birth_date: string | null;
  color_markings: string;
  microchip_number: string;
  care_preferences: string;
  notes: string;
  photo_file_id: string | null;
  archived_at: string | null;
};

const toView = (r: PetRow): PetView => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  species: r.species as PetSpecies,
  breed: r.breed,
  sex: r.sex as PetView["sex"],
  birthDate: r.birth_date,
  colorMarkings: r.color_markings,
  microchipNumber: r.microchip_number,
  carePreferences: r.care_preferences,
  notes: r.notes,
  photoFileId: r.photo_file_id,
  archivedAt: r.archived_at,
});

export async function listPets(
  ctx: ServiceContext,
  householdId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Result<PetView[]>> {
  let query = ctx.db.from("pets").select(COLUMNS).eq("household_id", householdId);
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("name");
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as PetRow)));
}

export async function getPet(ctx: ServiceContext, petId: string): Promise<Result<PetView>> {
  const { data, error } = await ctx.db.from("pets").select(COLUMNS).eq("id", petId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Pet not found."));
  return ok(toView(data as PetRow));
}

const columnsFrom = (v: Omit<ReturnType<typeof UpdatePetInput.parse>, "petId">) => ({
  name: v.name,
  species: v.species,
  breed: v.breed,
  sex: v.sex,
  birth_date: v.birthDate,
  color_markings: v.colorMarkings,
  microchip_number: v.microchipNumber,
  care_preferences: v.carePreferences,
  notes: v.notes,
});

export async function createPet(ctx: ServiceContext, input: unknown): Promise<Result<{ petId: string }>> {
  const parsed = parseInput(CreatePetInput, input);
  if (!parsed.ok) return parsed;
  const { householdId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("pets")
    .insert({ household_id: householdId, ...columnsFrom(rest) })
    .select("id")
    .single();
  if (error)
    return err(
      error.code === "42501" ? appError.forbidden("You can't add pets to this household.") : mapDbError(error),
    );
  return ok({ petId: data.id });
}

export async function updatePet(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdatePetInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("pets")
    .update(columnsFrom(parsed.value))
    .eq("id", parsed.value.petId)
    .is("archived_at", null)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't edit this pet."));
  return ok(true);
}

async function setArchived(ctx: ServiceContext, input: unknown, archived: boolean): Promise<Result<true>> {
  const parsed = parseInput(PetIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("pets")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.value.petId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't change this pet."));
  return ok(true);
}
export const archivePet = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, true);
export const restorePet = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, false);

export async function setPetPhoto(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetPetPhotoInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("pets")
    .update({ photo_file_id: parsed.value.fileId })
    .eq("id", parsed.value.petId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't change this pet."));
  return ok(true);
}

export async function addPetHealthRecord(ctx: ServiceContext, input: unknown): Promise<Result<{ recordId: string }>> {
  const parsed = parseInput(AddPetHealthRecordInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const pet = await getPet(ctx, v.petId);
  if (!pet.ok) return pet;
  if (pet.value.archivedAt) return err(appError.conflict("Restore this pet before adding records.", "archived"));
  const { data, error } = await ctx.db
    .from("pet_health_records")
    .insert({
      pet_id: v.petId,
      household_id: pet.value.householdId,
      kind: v.kind,
      title: v.title,
      occurred_on: v.occurredOn,
      next_due_on: v.nextDueOn,
      clinic_or_provider: v.clinicOrProvider,
      notes: v.notes,
      cost_centavos: v.costCentavos,
    })
    .select("id")
    .single();
  if (error)
    return err(error.code === "42501" ? appError.forbidden("You can't add this kind of record.") : mapDbError(error));
  return ok({ recordId: data.id });
}

/** RLS hides veterinary records from roles without pet.health.view; grooming stays visible. */
export async function listPetHealthRecords(ctx: ServiceContext, petId: string): Promise<Result<PetHealthRecordView[]>> {
  const { data, error } = await ctx.db
    .from("pet_health_records")
    .select("id, kind, title, occurred_on, next_due_on, clinic_or_provider, notes, cost_centavos")
    .eq("pet_id", petId)
    .order("occurred_on", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind as PetHealthKind,
      title: r.title,
      occurredOn: r.occurred_on,
      nextDueOn: r.next_due_on,
      clinicOrProvider: r.clinic_or_provider,
      notes: r.notes,
      costCentavos: r.cost_centavos,
    })),
  );
}

export async function deletePetHealthRecord(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(RecordIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.from("pet_health_records").delete().eq("id", parsed.value.recordId).select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.notFound("Record not found."));
  return ok(true);
}
