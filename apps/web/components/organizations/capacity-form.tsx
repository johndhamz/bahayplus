"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { setCapacityAction } from "@/lib/actions/operations";

export function CapacityForm({ organizationId, capacity }: { organizationId: string; capacity: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(capacity));
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setCapacityAction({ organizationId, capacity: value });
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("Capacity saved.");
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Jobs you can take at the same time
        <Input
          type="number"
          min={1}
          max={50}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28"
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
