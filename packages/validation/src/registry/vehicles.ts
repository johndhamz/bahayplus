import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalInt, OptionalIsoDate, OptionalPesoAmount, RequiredIsoDate, text } from "../common/fields";

export const VEHICLE_TYPES = ["car", "suv", "van", "pickup", "motorcycle", "tricycle", "other"] as const;
export const VehicleType = z.enum(VEHICLE_TYPES, { message: "Choose a vehicle type." });
export type VehicleType = z.infer<typeof VehicleType>;

/** Normalise a Philippine plate: uppercase, single spaces, letters/digits/dash only. "abc  1234" → "ABC 1234". */
export function normalizePlate(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PlateNumber = z
  .string()
  .default("")
  .transform(normalizePlate)
  .refine((v) => v.length <= 12, "Plate numbers are at most 12 characters.");

const VehicleFields = z.object({
  vehicleType: VehicleType,
  make: z.string().trim().min(1, "Enter the make, e.g. Toyota or Honda.").max(60),
  model: z.string().trim().min(1, "Enter the model, e.g. Vios or Click 125i.").max(60),
  year: OptionalInt(1950, new Date().getFullYear() + 1, "Year"),
  plateNumber: PlateNumber,
  color: text(40),
  mileageKm: OptionalInt(0, 2_000_000, "Mileage"),
  registrationExpiresOn: OptionalIsoDate,
  insuranceProvider: text(120),
  insuranceExpiresOn: OptionalIsoDate,
  maintenanceIntervalMonths: OptionalInt(1, 60, "Maintenance interval (months)"),
  maintenanceIntervalKm: OptionalInt(500, 100_000, "Maintenance interval (km)"),
  notes: text(2000),
});

export const CreateVehicleInput = VehicleFields.extend({ householdId: Uuid });
export type CreateVehicleInput = z.input<typeof CreateVehicleInput>;
export const UpdateVehicleInput = VehicleFields.extend({ vehicleId: Uuid });
export type UpdateVehicleInput = z.input<typeof UpdateVehicleInput>;
export const VehicleIdInput = z.object({ vehicleId: Uuid });

export const VEHICLE_SERVICE_KINDS = [
  "preventive_maintenance",
  "oil_change",
  "repair",
  "tires",
  "battery",
  "inspection",
  "registration_renewal",
  "insurance_renewal",
  "car_wash",
  "other",
] as const;
export const AddVehicleServiceRecordInput = z.object({
  vehicleId: Uuid,
  servicedOn: RequiredIsoDate,
  odometerKm: OptionalInt(0, 2_000_000, "Odometer"),
  kind: z.enum(VEHICLE_SERVICE_KINDS),
  description: text(1000),
  providerName: text(120),
  costCentavos: OptionalPesoAmount,
});
export type AddVehicleServiceRecordInput = z.input<typeof AddVehicleServiceRecordInput>;
