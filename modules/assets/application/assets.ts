import {
  AddAssetServiceRecordInput,
  AssetIdInput,
  CreateAssetInput,
  RecordIdInput,
  UpdateAssetInput,
  type AssetCategory,
} from "@bahayplus/validation/registry/assets";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type AssetView = {
  id: string;
  householdId: string;
  propertyId: string | null;
  propertyName: string | null;
  name: string;
  category: AssetCategory;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string | null;
  purchasePriceCentavos: number | null;
  warrantyExpiresOn: string | null;
  maintenanceIntervalMonths: number | null;
  lastMaintainedOn: string | null;
  notes: string;
  archivedAt: string | null;
};

export type AssetServiceRecordView = {
  id: string;
  servicedOn: string;
  kind: string;
  description: string;
  providerName: string;
  costCentavos: number | null;
  bookingId: string | null;
};

const COLUMNS =
  "id, household_id, property_id, name, category, brand, model, serial_number, purchase_date, purchase_price_centavos, warranty_expires_on, maintenance_interval_months, last_maintained_on, notes, archived_at, properties(name)";

type AssetRow = {
  id: string;
  household_id: string;
  property_id: string | null;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string | null;
  purchase_price_centavos: number | null;
  warranty_expires_on: string | null;
  maintenance_interval_months: number | null;
  last_maintained_on: string | null;
  notes: string;
  archived_at: string | null;
  properties: { name: string } | null;
};

const toView = (r: AssetRow): AssetView => ({
  id: r.id,
  householdId: r.household_id,
  propertyId: r.property_id,
  propertyName: r.properties?.name ?? null,
  name: r.name,
  category: r.category as AssetCategory,
  brand: r.brand,
  model: r.model,
  serialNumber: r.serial_number,
  purchaseDate: r.purchase_date,
  purchasePriceCentavos: r.purchase_price_centavos,
  warrantyExpiresOn: r.warranty_expires_on,
  maintenanceIntervalMonths: r.maintenance_interval_months,
  lastMaintainedOn: r.last_maintained_on,
  notes: r.notes,
  archivedAt: r.archived_at,
});

export async function listAssets(
  ctx: ServiceContext,
  householdId: string,
  filter: { propertyId?: string; category?: AssetCategory; includeArchived?: boolean } = {},
): Promise<Result<AssetView[]>> {
  let query = ctx.db.from("assets").select(COLUMNS).eq("household_id", householdId);
  if (!filter.includeArchived) query = query.is("archived_at", null);
  if (filter.propertyId) query = query.eq("property_id", filter.propertyId);
  if (filter.category) query = query.eq("category", filter.category);
  const { data, error } = await query.order("name").limit(500);
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as unknown as AssetRow)));
}

export async function getAsset(ctx: ServiceContext, assetId: string): Promise<Result<AssetView>> {
  const { data, error } = await ctx.db.from("assets").select(COLUMNS).eq("id", assetId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Item not found."));
  return ok(toView(data as unknown as AssetRow));
}

function columnsFrom(v: Omit<ReturnType<typeof UpdateAssetInput.parse>, "assetId">) {
  return {
    property_id: v.propertyId,
    name: v.name,
    category: v.category,
    brand: v.brand,
    model: v.model,
    serial_number: v.serialNumber,
    purchase_date: v.purchaseDate,
    purchase_price_centavos: v.purchasePriceCentavos,
    warranty_expires_on: v.warrantyExpiresOn,
    maintenance_interval_months: v.maintenanceIntervalMonths,
    notes: v.notes,
  };
}

export async function createAsset(ctx: ServiceContext, input: unknown): Promise<Result<{ assetId: string }>> {
  const parsed = parseInput(CreateAssetInput, input);
  if (!parsed.ok) return parsed;
  const { householdId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("assets")
    .insert({ household_id: householdId, ...columnsFrom(rest) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return err(appError.forbidden("You can't add items to this household."));
    // 23503: the chosen property is not in this household.
    if (error.code === "23503")
      return err(appError.validation([{ path: ["propertyId"], message: "Choose a property from this household." }]));
    return err(mapDbError(error));
  }
  return ok({ assetId: data.id });
}

export async function updateAsset(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateAssetInput, input);
  if (!parsed.ok) return parsed;
  const { assetId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("assets")
    .update(columnsFrom(rest))
    .eq("id", assetId)
    .is("archived_at", null)
    .select("id");
  if (error) {
    if (error.code === "23503")
      return err(appError.validation([{ path: ["propertyId"], message: "Choose a property from this household." }]));
    return err(mapDbError(error));
  }
  if (!data?.length)
    return err(appError.forbidden("You can't edit this item (it may be archived, or you lack permission)."));
  return ok(true);
}

async function setArchived(ctx: ServiceContext, input: unknown, archived: boolean): Promise<Result<true>> {
  const parsed = parseInput(AssetIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("assets")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.value.assetId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't change this item."));
  return ok(true);
}
export const archiveAsset = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, true);
export const restoreAsset = (ctx: ServiceContext, input: unknown) => setArchived(ctx, input, false);

export async function addAssetServiceRecord(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ recordId: string }>> {
  const parsed = parseInput(AddAssetServiceRecordInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const asset = await getAsset(ctx, v.assetId);
  if (!asset.ok) return asset;
  if (asset.value.archivedAt) return err(appError.conflict("Restore this item before adding records.", "archived"));
  const { data, error } = await ctx.db
    .from("asset_service_records")
    .insert({
      asset_id: v.assetId,
      household_id: asset.value.householdId,
      serviced_on: v.servicedOn,
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

export async function listAssetServiceRecords(
  ctx: ServiceContext,
  assetId: string,
): Promise<Result<AssetServiceRecordView[]>> {
  const { data, error } = await ctx.db
    .from("asset_service_records")
    .select("id, serviced_on, kind, description, provider_name, cost_centavos, booking_id")
    .eq("asset_id", assetId)
    .order("serviced_on", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      servicedOn: r.serviced_on,
      kind: r.kind,
      description: r.description,
      providerName: r.provider_name,
      costCentavos: r.cost_centavos,
      bookingId: r.booking_id,
    })),
  );
}

export async function deleteAssetServiceRecord(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(RecordIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("asset_service_records")
    .delete()
    .eq("id", parsed.value.recordId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.notFound("Record not found."));
  return ok(true);
}
