import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, type DataTableColumn } from "@bahayplus/ui/components/data/data-table";
import { countActiveFilters, FilterPanel, type FilterValues } from "@bahayplus/ui/components/data/filter-panel";
import { SearchInput } from "@bahayplus/ui/components/data/search-input";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";

type Row = { id: string; name: string; amount: number };
const rows: Row[] = [
  { id: "1", name: "Electricity", amount: 100 },
  { id: "2", name: "Water", amount: 50 },
];
const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name, sortable: true },
  { key: "amount", header: "Amount", cell: (r) => r.amount, align: "right", hideOnMobile: true },
];

describe("StatCard", () => {
  it("renders label, value, hint and an accessible trend", () => {
    render(
      <StatCard
        label="Bills due"
        value="₱1,000.00"
        icon={Receipt}
        hint="2 this week"
        trend={{ direction: "down", label: "8%", sentiment: "positive" }}
      />,
    );
    expect(screen.getByText("Bills due")).toBeInTheDocument();
    expect(screen.getByText("₱1,000.00")).toBeInTheDocument();
    expect(screen.getByText("Down")).toHaveClass("sr-only");
  });

  it("becomes a link when given href", () => {
    render(<StatCard label="Pets" value={2} href="/app/pets" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/pets");
  });
});

describe("DataTable", () => {
  it("renders an accessible table with caption, headers and rows", () => {
    render(<DataTable caption="Bills" columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "Bills" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Bills" })).toHaveAttribute("tabindex", "0");
  });

  it("exposes sort state and next-direction links", () => {
    render(
      <DataTable
        caption="Bills"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        sort={{ key: "name", direction: "asc" }}
        sortHref={(k, d) => `?sort=${k}&dir=${d}`}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /name/i })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("link", { name: /name/i })).toHaveAttribute("href", "?sort=name&dir=desc");
  });

  it("renders the provided empty state when there are no rows", () => {
    render(<DataTable caption="Bills" columns={columns} rows={[]} getRowKey={(r) => r.id} empty={<p>No bills</p>} />);
    expect(screen.getByText("No bills")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders mobile cards alongside the table when provided", () => {
    render(
      <DataTable
        caption="Bills"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        mobileCard={(r) => <span>card {r.name}</span>}
      />,
    );
    expect(screen.getByRole("list", { name: "Bills" })).toBeInTheDocument();
    expect(screen.getByText("card Water")).toBeInTheDocument();
  });
});

describe("SearchInput", () => {
  afterEach(() => vi.useRealTimers());

  it("has an accessible label and debounces the callback", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(<SearchInput label="Search providers" onValueChange={onValueChange} debounceMs={300} />);
    const input = screen.getByRole("searchbox", { name: "Search providers" });
    fireEvent.change(input, { target: { value: "plum" } });
    fireEvent.change(input, { target: { value: "plumber " } });
    expect(onValueChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("plumber");
  });

  it("clears the value", async () => {
    const onValueChange = vi.fn();
    render(<SearchInput label="Search" defaultValue="aircon" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("works as a plain form field without a callback", () => {
    render(<SearchInput label="Search" name="q" defaultValue="x" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });
});

function FilterHarness({ initial = {} }: { initial?: FilterValues }) {
  const [value, setValue] = useState<FilterValues>(initial);
  return (
    <>
      <FilterPanel
        groups={[
          {
            id: "status",
            label: "Status",
            type: "checkbox",
            options: [
              { value: "paid", label: "Paid", count: 3 },
              { value: "unpaid", label: "Unpaid" },
            ],
          },
          {
            id: "city",
            label: "City",
            type: "radio",
            options: [
              { value: "qc", label: "Quezon City" },
              { value: "mkt", label: "Makati" },
            ],
          },
        ]}
        value={value}
        onChange={setValue}
        onReset={() => setValue({})}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

describe("FilterPanel", () => {
  it("groups options in labelled fieldsets", () => {
    render(<FilterHarness />);
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "City" })).toBeInTheDocument();
  });

  it("toggles checkboxes, keeps radios exclusive, counts and resets", async () => {
    render(<FilterHarness />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Paid/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Unpaid/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Quezon City" }));
    await userEvent.click(screen.getByRole("radio", { name: "Makati" }));
    expect(JSON.parse(screen.getByTestId("value").textContent!)).toEqual({ status: ["paid", "unpaid"], city: ["mkt"] });
    expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("3 active");
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByTestId("value").textContent).toBe("{}");
  });

  it("collapses on small screens via an expandable toggle", async () => {
    render(<FilterHarness />);
    const toggle = screen.getByRole("button", { name: /filters/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("counts active filters", () => {
    expect(countActiveFilters({ a: ["1", "2"], b: [], c: ["x"] })).toBe(3);
  });
});

describe("SectionCard", () => {
  it("labels the region with its heading and renders an action link", () => {
    render(
      <SectionCard title="Upcoming" id="up" action={{ href: "/app/calendar", label: "Calendar" }}>
        body
      </SectionCard>,
    );
    expect(screen.getByRole("region", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /calendar/i })).toHaveAttribute("href", "/app/calendar");
  });
});
