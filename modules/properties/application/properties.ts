import {
  CreatePropertyInput,
  PropertyIdInput,
  SetDefaultPropertyInput,
  UpdatePropertyInput,
  type PropertyType,
} from "@bahayplus/validation/properties/property";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type PropertyView = {
  id: string;
  householdId: string;
  name: string;
  propertyType: PropertyType;
  addressLine: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  isActive: boolean;
  archivedAt: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const COLUMNS =
  "id, household_id, name, property_type, address_line, barangay, city_municipality, province, postal_code, latitude, longitude, notes, is_active, archived_at, created_at, updated_at";

type Row = {
  id: string;
  household_id: string;
  name: string;
  property_type: string;
  address_line: string;
  barangay: string;
  city_municipality: string;
  province: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function toView(row: Row, defaultId: string | null): PropertyView {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    propertyType: row.property_type as PropertyType,
    addressLine: row.address_line,
    barangay: row.barangay,
    cityMunicipality: row.city_municipality,
    province: row.province,
    postalCode: row.postal_code,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    notes: row.notes,
    isActive: row.is_active,
    archivedAt: row.archived_at,
    isDefault: row.id === defaultId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function defaultPropertyId(ctx: ServiceContext, householdId: string): Promise<string | null> {
  const { data } = await ctx.db.from("households").select("default_property_id").eq("id", householdId).maybeSingle();
  return data?.default_property_id ?? null;
}

export async function listProperties(
  ctx: ServiceContext,
  householdId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Result<PropertyView[]>> {
  let query = ctx.db.from("properties").select(COLUMNS).eq("household_id", householdId);
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("archived_at", { ascending: true, nullsFirst: true }).order("created_at");
  if (error) return err(mapDbError(error));
  const defaultId = await defaultPropertyId(ctx, householdId);
  const views = (data ?? []).map((r) => toView(r as Row, defaultId));
  // Default first, then active, then archived.
  views.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(!!a.archivedAt) - Number(!!b.archivedAt));
  return ok(views);
}

export async function getProperty(ctx: ServiceContext, propertyId: string): Promise<Result<PropertyView>> {
  const { data, error } = await ctx.db.from("properties").select(COLUMNS).eq("id", propertyId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Property not found."));
  return ok(toView(data as Row, await defaultPropertyId(ctx, data.household_id)));
}

export async function createProperty(ctx: ServiceContext, input: unknown): Promise<Result<{ propertyId: string }>> {
  const parsed = parseInput(CreatePropertyInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("properties")
    .insert({
      household_id: v.householdId,
      name: v.name,
      property_type: v.propertyType,
      address_line: v.addressLine,
      barangay: v.barangay,
      city_municipality: v.cityMunicipality,
      province: v.province,
      postal_code: v.postalCode,
      latitude: v.latitude,
      longitude: v.longitude,
      notes: v.notes,
    })
    .select("id")
    .single();
  if (error) {
    // RLS rejection on insert means the caller lacks property.manage in that household.
    if (error.code === "42501") return err(appError.forbidden("You can't add properties to this household."));
    return err(mapDbError(error));
  }
  return ok({ propertyId: data.id });
}

export async function updateProperty(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdatePropertyInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("properties")
    .update({
      name: v.name,
      property_type: v.propertyType,
      address_line: v.addressLine,
      barangay: v.barangay,
      city_municipality: v.cityMunicipality,
      province: v.province,
      postal_code: v.postalCode,
      latitude: v.latitude,
      longitude: v.longitude,
      notes: v.notes,
      is_active: v.isActive,
    })
    .eq("id", v.propertyId)
    .is("archived_at", null)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data || data.length === 0) {
    return err(appError.forbidden("You can't edit this property (it may be archived, or you lack permission)."));
  }
  return ok(true);
}

async function setArchived(ctx: ServiceContext, input: unknown, archived: boolean): Promise<Result<true>> {
  const parsed = parseInput(PropertyIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("properties")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.value.propertyId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data || data.length === 0) return err(appError.forbidden("You can't change this property."));
  return ok(true);
}

/** Archive keeps the property and every record that references it; it just leaves active lists. */
export const archiveProperty = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, true);
export const restoreProperty = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, false);

export async function setDefaultProperty(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetDefaultPropertyInput, input);
  if (!parsed.ok) return parsed;
  // The property must be visible to the caller in this household (RLS), and active (enforced by trigger).
  const { data: canManage, error: permError } = await ctx.db
    .from("properties")
    .select("id")
    .eq("id", parsed.value.propertyId)
    .eq("household_id", parsed.value.householdId)
    .maybeSingle();
  if (permError) return err(mapDbError(permError));
  if (!canManage) return err(appError.notFound("Property not found."));
  const { data, error } = await ctx.db
    .from("households")
    .update({ default_property_id: parsed.value.propertyId })
    .eq("id", parsed.value.householdId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data || data.length === 0) return err(appError.forbidden("You can't change the default property."));
  return ok(true);
}
