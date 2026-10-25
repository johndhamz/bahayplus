import { Package } from "lucide-react";
import Link from "next/link";
import { listProducts } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { ProductForm } from "@/components/supply/supplier-forms";

export const metadata = { title: "Products" };

export default async function ProductsPage({ params }: PageProps<"/supplier/o/[orgId]/products">) {
  const { orgId } = await params;
  const { ctx, base, can } = await supplierContext(orgId);
  const products = await listProducts(ctx, orgId);
  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalog and prices."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Products" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title={`Catalog (${products.ok ? products.value.length : 0})`}
          id="catalog"
          className="xl:col-span-2"
        >
          {products.ok && products.value.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {products.value.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{[p.sku, p.category].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {formatPeso(p.unitPriceCentavos)} / {p.unit}
                  </span>
                  {!p.isActive && <StatusBadge status="inactive" />}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="compact"
              icon={Package}
              title="No products yet"
              description="Add your first product to start receiving orders."
            />
          )}
        </SectionCard>
        {can("catalog.manage") && (
          <SectionCard title="Add a product" id="add">
            <ProductForm organizationId={orgId} hrefBase={`${base}/products`} />
          </SectionCard>
        )}
      </div>
    </>
  );
}
