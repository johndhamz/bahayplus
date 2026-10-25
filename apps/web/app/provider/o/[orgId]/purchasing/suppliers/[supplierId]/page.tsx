import { notFound } from "next/navigation";
import { getSupplierProfile, listProducts, listSuppliers } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PurchaseOrderForm } from "@/components/supply/order-form";

export const metadata = { title: "Supplier" };

export default async function SupplierCatalogPage({
  params,
}: PageProps<"/provider/o/[orgId]/purchasing/suppliers/[supplierId]">) {
  const { orgId, supplierId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("purchasing.manage")) notFound();
  const suppliers = await listSuppliers(ctx);
  const supplier = suppliers.ok ? suppliers.value.find((s) => s.organizationId === supplierId) : undefined;
  if (!supplier) notFound();
  const [profile, products] = await Promise.all([
    getSupplierProfile(ctx, supplierId),
    listProducts(ctx, supplierId, { activeOnly: true }),
  ]);
  return (
    <>
      <PageHeader
        title={supplier.name}
        description={supplier.description}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Purchasing", href: `${base}/purchasing` },
          { label: supplier.name },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Place an order" id="order" className="xl:col-span-2">
          {products.ok && products.value.length ? (
            <PurchaseOrderForm
              buyerOrgId={orgId}
              supplierOrgId={supplierId}
              products={products.value}
              minOrderCentavos={supplier.minOrderCentavos}
              hrefBase={`${base}/purchasing/orders`}
            />
          ) : (
            <p className="text-sm text-muted-foreground">This supplier has no products listed.</p>
          )}
        </SectionCard>
        {profile.ok && (
          <SectionCard title="Supplier details" id="details">
            <dl className="flex flex-col gap-2 text-sm">
              {profile.value.address && (
                <div>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd>{profile.value.address}</dd>
                </div>
              )}
              {profile.value.deliveryAreas && (
                <div>
                  <dt className="text-muted-foreground">Delivers to</dt>
                  <dd>{profile.value.deliveryAreas}</dd>
                </div>
              )}
              {profile.value.phone && (
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${profile.value.phone.replace(/[^\d+]/g, "")}`}
                      className="text-brand hover:underline"
                    >
                      {profile.value.phone}
                    </a>
                  </dd>
                </div>
              )}
              {profile.value.email && (
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{profile.value.email}</dd>
                </div>
              )}
            </dl>
          </SectionCard>
        )}
      </div>
    </>
  );
}
