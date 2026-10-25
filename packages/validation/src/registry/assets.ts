import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalInt, OptionalIsoDate, OptionalPesoAmount, RequiredIsoDate, text } from "../common/fields";

export const ASSET_CATEGORIES = [
  "aircon",
  "refrigerator",
  "washing_machine",
  "kitchen_appliance",
  "water_heater",
  "water_system",
  "electronics",
  "electrical",
  "furniture",
  "tools",
  "outdoor",
  "other",
] as const;
export const AssetCategory = z.enum(ASSET_CATEGORIES, { message: "Choose a category." });
export type AssetCategory = z.infer<typeof AssetCategory>;

const OptionalUuid = z
  .union([Uuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const AssetFields = z.object({
  name: z.string().trim().min(1, "Give this item a name.").max(120),
  category: AssetCategory,
  propertyId: OptionalUuid,
  brand: text(80),
  model: text(80),
  serialNumber: text(80),
  purchaseDate: OptionalIsoDate,
  purchasePriceCentavos: OptionalPesoAmount,
  warrantyExpiresOn: OptionalIsoDate,
  maintenanceIntervalMonths: OptionalInt(1, 120, "Maintenance interval"),
  notes: text(2000),
});

const warrantyAfterPurchase = (v: { purchaseDate: string | null; warrantyExpiresOn: string | null }) =>
  !v.purchaseDate || !v.warrantyExpiresOn || v.warrantyExpiresOn >= v.purchaseDate;
const warrantyMessage = { path: ["warrantyExpiresOn"], message: "Warranty can't end before the purchase date." };

export const CreateAssetInput = AssetFields.extend({ householdId: Uuid }).refine(
  warrantyAfterPurchase,
  warrantyMessage,
);
export type CreateAssetInput = z.input<typeof CreateAssetInput>;
export const UpdateAssetInput = AssetFields.extend({ assetId: Uuid }).refine(warrantyAfterPurchase, warrantyMessage);
export type UpdateAssetInput = z.input<typeof UpdateAssetInput>;
export const AssetIdInput = z.object({ assetId: Uuid });

export const ASSET_SERVICE_KINDS = [
  "maintenance",
  "cleaning",
  "repair",
  "inspection",
  "installation",
  "other",
] as const;
export const AddAssetServiceRecordInput = z.object({
  assetId: Uuid,
  servicedOn: RequiredIsoDate,
  kind: z.enum(ASSET_SERVICE_KINDS),
  description: text(1000),
  providerName: text(120),
  costCentavos: OptionalPesoAmount,
});
export type AddAssetServiceRecordInput = z.input<typeof AddAssetServiceRecordInput>;
export const RecordIdInput = z.object({ recordId: Uuid });
