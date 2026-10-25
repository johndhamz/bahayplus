import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalIsoDate, OptionalPesoAmount, RequiredIsoDate, text } from "../common/fields";

export const PET_SPECIES = ["dog", "cat", "bird", "fish", "rabbit", "hamster", "reptile", "other"] as const;
export const PetSpecies = z.enum(PET_SPECIES, { message: "Choose a species." });
export type PetSpecies = z.infer<typeof PetSpecies>;

const PetFields = z.object({
  name: z.string().trim().min(1, "Enter your pet's name.").max(80),
  species: PetSpecies,
  breed: text(80),
  sex: z.enum(["male", "female", "unknown"]).default("unknown"),
  birthDate: OptionalIsoDate,
  colorMarkings: text(120),
  microchipNumber: text(40),
  carePreferences: text(2000),
  notes: text(2000),
});

export const CreatePetInput = PetFields.extend({ householdId: Uuid });
export type CreatePetInput = z.input<typeof CreatePetInput>;
export const UpdatePetInput = PetFields.extend({ petId: Uuid });
export type UpdatePetInput = z.input<typeof UpdatePetInput>;
export const PetIdInput = z.object({ petId: Uuid });

export const PET_HEALTH_KINDS = ["vaccination", "vet_visit", "deworming", "medication", "grooming", "other"] as const;
export type PetHealthKind = (typeof PET_HEALTH_KINDS)[number];
/** Grooming history is ordinary household data; all other kinds are protected veterinary records. */
export const isSensitiveHealthKind = (kind: PetHealthKind) => kind !== "grooming";

export const AddPetHealthRecordInput = z
  .object({
    petId: Uuid,
    kind: z.enum(PET_HEALTH_KINDS),
    title: z.string().trim().min(1, "What was it? e.g. Anti-rabies, 5-in-1, Annual check-up").max(120),
    occurredOn: RequiredIsoDate,
    nextDueOn: OptionalIsoDate,
    clinicOrProvider: text(120),
    notes: text(2000),
    costCentavos: OptionalPesoAmount,
  })
  .refine((v) => !v.nextDueOn || v.nextDueOn >= v.occurredOn, {
    path: ["nextDueOn"],
    message: "The next due date must be on or after the visit.",
  });
export type AddPetHealthRecordInput = z.input<typeof AddPetHealthRecordInput>;
export const SetPetPhotoInput = z.object({ petId: Uuid, fileId: Uuid.nullable() });
