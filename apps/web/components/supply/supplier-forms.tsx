"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ProductView, SupplierProfileView } from "@bahayplus/modules/suppliers";
import type { InventoryRow } from "@bahayplus/modules/inventory";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import type { ActionResult } from "@bahayplus/types/action-result";
import { formatPeso } from "@bahayplus/types/money";
import {
  CreateProductInput,
  UpdateProductInput,
  UpdateSupplierProfileInput,
} from "@bahayplus/validation/supply/supply";
import { asAnyControl, MoneyField, TextAreaField, TextField, selectClassName } from "@/components/forms/fields";
import {
  createProductAction,
  recordStockAction,
  updateProductAction,
  updateSupplierProfileAction,
} from "@/lib/actions/operations";

const peso = (c: number) => formatPeso(c).replace("₱", "");

export function SupplierProfileForm({ profile }: { profile: SupplierProfileView }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateSupplierProfileInput,
    defaultValues: {
      organizationId: profile.organizationId,
      description: profile.description,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      deliveryAreas: profile.deliveryAreas,
      minOrderCentavos: peso(profile.minOrderCentavos),
      isPublished: profile.isPublished,
    },
    action: updateSupplierProfileAction,
    onSuccess: () => {
      toast.success("Profile saved.");
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <TextAreaField control={control} name="description" label="About your business" rows={3} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="phone" label="Phone" />
        <TextField control={control} name="email" label="Orders email" inputProps={{ type: "email" }} />
        <TextField control={control} name="address" label="Warehouse / store address" />
        <TextField
          control={control}
          name="deliveryAreas"
          label="Delivery areas"
          description="e.g. Metro Manila, Rizal"
        />
        <MoneyField control={control} name="minOrderCentavos" label="Minimum order" />
      </div>
      <label className="flex min-h-10 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--brand)]" {...form.register("isPublished")} />
        List my catalog for service providers on Bahay+
      </label>
      <SubmitButton pending={pending} className="w-fit">
        Save profile
      </SubmitButton>
    </form>
  );
}

export function ProductForm({
  organizationId,
  product,
  hrefBase,
}: {
  organizationId: string;
  product?: ProductView;
  hrefBase: string;
}) {
  const router = useRouter();
  const editing = !!product;
  const defaults = {
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "",
    unit: product?.unit ?? "pc",
    unitPriceCentavos: product ? peso(product.unitPriceCentavos) : "",
    reorderLevel: product ? String(product.reorderLevel) : "0",
    isActive: product?.isActive ?? true,
  };
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: editing ? UpdateProductInput : CreateProductInput,
    defaultValues: editing ? { productId: product.id, ...defaults } : { organizationId, ...defaults },
    action: async (v): Promise<ActionResult<unknown>> => (editing ? updateProductAction(v) : createProductAction(v)),
    onSuccess: () => {
      toast.success(editing ? "Product saved." : "Product added.");
      if (editing) router.refresh();
      else {
        form.reset({ organizationId, ...defaults });
        router.refresh();
      }
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField control={control} name="sku" label="SKU" required />
        <TextField control={control} name="name" label="Product name" required />
        <TextField control={control} name="category" label="Category" />
        <TextField control={control} name="unit" label="Unit" required description="pc, box, bag, m…" />
        <MoneyField control={control} name="unitPriceCentavos" label="Price per unit" required />
        <TextField
          control={control}
          name="reorderLevel"
          label="Reorder level"
          inputProps={{ inputMode: "decimal" }}
          description="Flag as low stock at or below this."
        />
      </div>
      <TextAreaField control={control} name="description" label="Description" rows={2} />
      <label className="flex min-h-10 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--brand)]" {...form.register("isActive")} />
        Available to order
      </label>
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="w-fit">
          {editing ? "Save product" : "Add product"}
        </SubmitButton>
        {editing && (
          <Button type="button" variant="ghost" onClick={() => router.push(hrefBase)}>
            Back to products
          </Button>
        )}
      </div>
    </form>
  );
}

export function StockForm({ inventory, defaultProductId }: { inventory: InventoryRow[]; defaultProductId?: string }) {
  const router = useRouter();
  const [productId, setProductId] = useState(defaultProductId ?? inventory[0]?.productId ?? "");
  const [reason, setReason] = useState<"receipt" | "adjustment" | "return">("receipt");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  if (!inventory.length) return <p className="text-sm text-muted-foreground">Add a product first.</p>;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await recordStockAction({ productId, quantity, reason, note, idempotencyKey: key });
          if (!r.ok) return setError(r.error.message);
          toast.success("Stock updated.");
          setQuantity("");
          setNote("");
          setKey(crypto.randomUUID());
          router.refresh();
        });
      }}
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Product
        <select className={selectClassName} value={productId} onChange={(e) => setProductId(e.target.value)}>
          {inventory.map((i) => (
            <option key={i.productId} value={i.productId}>
              {i.name} ({i.sku})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Type
        <select className={selectClassName} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
          <option value="receipt">Stock received</option>
          <option value="return">Customer return</option>
          <option value="adjustment">Adjustment / count correction</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Quantity
        <Input inputMode="decimal" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <span className="text-xs font-normal text-muted-foreground">
          For adjustments, use a minus sign to remove stock (e.g. −2 damaged).
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending} className="w-fit">
        Record
      </Button>
    </form>
  );
}
