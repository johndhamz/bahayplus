"use client";

import { useState } from "react";
import { FilterPanel, type FilterValues } from "@bahayplus/ui/components/data/filter-panel";
import { SearchInput } from "@bahayplus/ui/components/data/search-input";

export function BusinessFilters() {
  const [value, setValue] = useState<FilterValues>({});
  return (
    <div className="flex flex-col gap-3">
      <SearchInput label="Search bookings" placeholder="Search bookings" />
      <FilterPanel
        groups={[
          {
            id: "status",
            label: "Status",
            type: "checkbox",
            options: ["pending", "confirmed", "in_progress", "cancelled"].map((s) => ({
              value: s,
              label: s.replace("_", " "),
            })),
          },
        ]}
        value={value}
        onChange={setValue}
        onReset={() => setValue({})}
      />
    </div>
  );
}
