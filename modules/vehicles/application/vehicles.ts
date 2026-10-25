import {
  AddVehicleServiceRecordInput,
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleIdInput,
  type VehicleType,
} from "@bahayplus/validation/registry/vehicles";
import { RecordIdInput } from "@bahayplus/validation/registry/assets";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type VehicleView = {
  id: string;
  householdId: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number | null;
  plateNumber: string;
  color: string;
  mileageKm: number | null;
  registrationExpiresOn: string | null;
  insuranceProvider: string;
  insuranceExpiresOn: string | null;
  maintenanceIntervalMonths: number | null;
  maintenanceIntervalKm: number | null;
  lastMaintainedOn: string | null;
  lastMaintainedKm: number | null;
  notes: string;
  archivedAt: string | null;
};

export type VehicleServiceRecordView = {
  id: string;
  servicedOn: string;
  odometerKm: number | null;
  kind: string;
  description: string;
  providerName: string;
  costCentavos: number | null;
};

const COLUMNS =
  "id, household_id, vehicle_type, make, model, year, plate_number, color, mileage_km, registration_expires_on, insurance_provider, insurance_expires_on, maintenance_interval_months, maintenance_interval_km, last_maintained_on, last_maintained_km, notes, archived_at";

type VehicleRow = {
  id: string;
  household_id: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: number | null;
  plate_number: string;
  color: string;
  mileage_km: number | null;
  registration_expires_on: string | null;
  insurance_provider: string;
  insurance_expires_on: string | null;
  maintenance_interval_months: number | null;
  maintenance_interval_km: number | null;
  last_maintained_on: string | null;
  last_maintained_km: number | null;
  notes: string;
  archived_at: string | null;
};

const toView = (r: VehicleRow): VehicleView => ({
  id: r.id,
  householdId: r.household_id,
  vehicleType: r.vehicle_type as VehicleType,
  make: r.make,
  model: r.model,
  year: r.year,
  plateNumber: r.plate_number,
  color: r.color,
  mileageKm: r.mileage_km,
  registrationExpiresOn: r.registration_expires_on,
  insuranceProvider: r.insurance_provider,
  insuranceExpiresOn: r.insurance_expires_on,
  maintenanceIntervalMonths: r.maintenance_interval_months,
  maintenanceIntervalKm: r.maintenance_interval_km,
  lastMaintainedOn: r.last_maintained_on,
  lastMaintainedKm: r.last_maintained_km,
  notes: r.notes,
  archivedAt: r.archived_at,
});

export async function listVehicles(
  ctx: ServiceContext,
  householdId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Result<VehicleView[]>> {
  let query = ctx.db.from("vehicles").select(COLUMNS).eq("household_id", householdId);
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("make").order("model");
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as VehicleRow)));
}

export async function getVehicle(ctx: ServiceContext, vehicleId: string): Promise<Result<VehicleView>> {
  const { data, error } = await ctx.db.from("vehicles").select(COLUMNS).eq("id", vehicleId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Vehicle not found."));
  return ok(toView(data as VehicleRow));
}

const columnsFrom = (v: Omit<ReturnType<typeof UpdateVehicleInput.parse>, "vehicleId">) => ({
  vehicle_type: v.vehicleType,
  make: v.make,
  model: v.model,
  year: v.year,
  plate_number: v.plateNumber,
  color: v.color,
  mileage_km: v.mileageKm,
  registration_expires_on: v.registrationExpiresOn,
  insurance_provider: v.insuranceProvider,
  insurance_expires_on: v.insuranceExpiresOn,
  maintenance_interval_months: v.maintenanceIntervalMonths,
  maintenance_interval_km: v.maintenanceIntervalKm,
  notes: v.notes,
});

const duplicatePlate = (code?: string) =>
  code === "23505"
    ? appError.validation([{ path: ["plateNumber"], message: "This household already has a vehicle with that plate." }])
    : null;

export async function createVehicle(ctx: ServiceContext, input: unknown): Promise<Result<{ vehicleId: string }>> {
  const parsed = parseInput(CreateVehicleInput, input);
  if (!parsed.ok) return parsed;
  const { householdId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("vehicles")
    .insert({ household_id: householdId, ...columnsFrom(rest) })
    .select("id")
    .single();
  if (error)
    return err(
      duplicatePlate(error.code) ??
        (error.code === "42501" ? appError.forbidden("You can't add vehicles to this household.") : mapDbError(error)),
    );
  return ok({ vehicleId: data.id });
}

export async function updateVehicle(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateVehicleInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("vehicles")
    .update(columnsFrom(parsed.value))
    .eq("id", parsed.value.vehicleId)
    .is("archived_at", null)
    .select("id");
  if (error) return err(duplicatePlate(error.code) ?? mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't edit this vehicle."));
  return ok(true);
}

async function setArchived(ctx: ServiceContext, input: unknown, archived: boolean): Promise<Result<true>> {
  const parsed = parseInput(VehicleIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("vehicles")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.value.vehicleId)
    .select("id");
  if (error) return err(duplicatePlate(error.code) ?? mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't change this vehicle."));
  return ok(true);
}
export const archiveVehicle = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, true);
export const restoreVehicle = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, false);

export async function addVehicleServiceRecord(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ recordId: string }>> {
  const parsed = parseInput(AddVehicleServiceRecordInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const vehicle = await getVehicle(ctx, v.vehicleId);
  if (!vehicle.ok) return vehicle;
  if (vehicle.value.archivedAt)
    return err(appError.conflict("Restore this vehicle before adding records.", "archived"));
  const { data, error } = await ctx.db
    .from("vehicle_service_records")
    .insert({
      vehicle_id: v.vehicleId,
      household_id: vehicle.value.householdId,
      serviced_on: v.servicedOn,
      odometer_km: v.odometerKm,
      kind: v.kind,
      description: v.description,
      provider_name: v.providerName,
      cost_centavos: v.costCentavos,
    })
    .select("id")
    .single();
  if (error) return err(error.code === "42501" ? appError.forbidden() : mapDbError(error));
  return ok({ recordId: data.id });
}

export async function listVehicleServiceRecords(
  ctx: ServiceContext,
  vehicleId: string,
): Promise<Result<VehicleServiceRecordView[]>> {
  const { data, error } = await ctx.db
    .from("vehicle_service_records")
    .select("id, serviced_on, odometer_km, kind, description, provider_name, cost_centavos")
    .eq("vehicle_id", vehicleId)
    .order("serviced_on", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      servicedOn: r.serviced_on,
      odometerKm: r.odometer_km,
      kind: r.kind,
      description: r.description,
      providerName: r.provider_name,
      costCentavos: r.cost_centavos,
    })),
  );
}

export async function deleteVehicleServiceRecord(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(RecordIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("vehicle_service_records")
    .delete()
    .eq("id", parsed.value.recordId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.notFound("Record not found."));
  return ok(true);
}
