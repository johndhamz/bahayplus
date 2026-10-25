import {
  CreateProductInput,
  UpdateProductInput,
  UpdateSupplierProfileInput,
} from "@bahayplus/validation/supply/supply";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type SupplierProfileView = {
  organizationId: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  deliveryAreas: string;
  minOrderCentavos: number;
  isPublished: boolean;
};
export type ProductView = {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  unitPriceCentavos: number;
  reorderLevel: number;
  isActive: boolean;
};
export type SupplierDirectoryEntry = {
  organizationId: string;
  name: string;
  description: string;
  deliveryAreas: string;
  minOrderCentavos: number;
};

export async function getSupplierProfile(
  ctx: ServiceContext,
  organizationId: string,
): Promise<Result<SupplierProfileView>> {
  const { data, error } = await ctx.db
    .from("supplier_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Supplier not found."));
  return ok({
    organizationId: data.organization_id,
    description: data.description,
    phone: data.phone,
    email: data.email,
    address: data.address,
    deliveryAreas: data.delivery_areas,
    minOrderCentavos: data.min_order_centavos,
    isPublished: data.is_published,
  });
}

export async function updateSupplierProfile(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateSupplierProfileInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("supplier_profiles")
    .update({
      description: v.description,
      phone: v.phone,
      email: v.email,
      address: v.address,
      delivery_areas: v.deliveryAreas,
      min_order_centavos: v.minOrderCentavos,
      is_published: v.isPublished,
    })
    .eq("organization_id", v.organizationId)
    .select("organization_id");
  if (error) return err(mapDbError(error));
  return data?.length ? ok(true) : err(appError.forbidden("You can't edit this supplier profile."));
}

/** Published suppliers (directory for buyers). */
export async function listSuppliers(ctx: ServiceContext): Promise<Result<SupplierDirectoryEntry[]>> {
  const { data, error } = await ctx.db
    .from("supplier_profiles")
    .select("organization_id, description, delivery_areas, min_order_centavos, organizations!inner(name)")
    .eq("is_published", true);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? [])
      .map((s) => ({
        organizationId: s.organization_id,
        name: s.organizations.name,
        description: s.description,
        deliveryAreas: s.delivery_areas,
        minOrderCentavos: s.min_order_centavos,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

const toProduct = (p: {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_price_centavos: number;
  reorder_level: number;
  is_active: boolean;
}): ProductView => ({
  id: p.id,
  organizationId: p.organization_id,
  sku: p.sku,
  name: p.name,
  description: p.description,
  category: p.category,
  unit: p.unit,
  unitPriceCentavos: p.unit_price_centavos,
  reorderLevel: Number(p.reorder_level),
  isActive: p.is_active,
});

export async function listProducts(
  ctx: ServiceContext,
  organizationId: string,
  options: { activeOnly?: boolean } = {},
): Promise<Result<ProductView[]>> {
  let q = ctx.db.from("products").select("*").eq("organization_id", organizationId);
  if (options.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("category").order("name");
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map(toProduct));
}

export async function getProduct(ctx: ServiceContext, productId: string): Promise<Result<ProductView>> {
  const { data, error } = await ctx.db.from("products").select("*").eq("id", productId).maybeSingle();
  if (error) return err(mapDbError(error));
  return data ? ok(toProduct(data)) : err(appError.notFound("Product not found."));
}

const productColumns = (v: Omit<ReturnType<typeof UpdateProductInput.parse>, "productId">) => ({
  sku: v.sku,
  name: v.name,
  description: v.description,
  category: v.category,
  unit: v.unit,
  unit_price_centavos: v.unitPriceCentavos,
  reorder_level: v.reorderLevel,
  is_active: v.isActive,
});

export async function createProduct(ctx: ServiceContext, input: unknown): Promise<Result<{ productId: string }>> {
  const parsed = parseInput(CreateProductInput, input);
  if (!parsed.ok) return parsed;
  const { organizationId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("products")
    .insert({ organization_id: organizationId, ...productColumns(rest) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return err(appError.conflict("A product with this SKU already exists.", "duplicate_sku"));
    if (error.code === "42501") return err(appError.forbidden("Only owners and managers can edit the catalog."));
    return err(mapDbError(error));
  }
  return ok({ productId: data.id });
}

export async function updateProduct(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateProductInput, input);
  if (!parsed.ok) return parsed;
  const { productId, ...rest } = parsed.value;
  const { data, error } = await ctx.db.from("products").update(productColumns(rest)).eq("id", productId).select("id");
  if (error)
    return err(
      error.code === "23505"
        ? appError.conflict("A product with this SKU already exists.", "duplicate_sku")
        : mapDbError(error),
    );
  return data?.length ? ok(true) : err(appError.forbidden("You can't edit this product."));
}
