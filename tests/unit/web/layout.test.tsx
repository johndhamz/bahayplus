import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Header } from "@/components/layout/header";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Sidebar } from "@/components/layout/sidebar";

const mockedPathname = vi.mocked(usePathname);

beforeEach(() => {
  mockedPathname.mockReturnValue("/app");
  localStorage.clear();
});

describe("Sidebar", () => {
  it("renders portal navigation and marks the current page", () => {
    mockedPathname.mockReturnValue("/provider/bookings");
    render(<Sidebar portal="provider" basePath="/provider" />);
    const nav = screen.getByRole("navigation", { name: "Provider navigation" });
    expect(within(nav).getByRole("link", { name: "Bookings" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("collapses, keeps labels for screen readers and remembers the preference", async () => {
    render(<Sidebar portal="admin" basePath="/admin" />);
    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Audit log")).toHaveClass("sr-only");
    expect(localStorage.getItem("bahayplus.sidebar.collapsed")).toBe("1");
  });
});

describe("MobileBottomNavigation", () => {
  it("shows at most four primary tabs plus More", () => {
    render(<MobileBottomNavigation portal="app" basePath="/app" />);
    const nav = screen.getByRole("navigation", { name: "Home quick navigation" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("opens the secondary menu as a dialog", async () => {
    render(<MobileBottomNavigation portal="app" basePath="/app" />);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Pets" })).toHaveAttribute("href", "/app/pets");
  });

  it("highlights More when the current page is a secondary item", () => {
    mockedPathname.mockReturnValue("/app/pets");
    render(<MobileBottomNavigation portal="app" basePath="/app" />);
    expect(screen.getByRole("button", { name: "More" })).toHaveClass("text-brand");
  });
});

describe("Header", () => {
  it("offers a slide-out menu for desktop-first portals on small screens", async () => {
    render(<Header portal="supplier" basePath="/supplier" mobileMenu actions={<button>Account</button>} />);
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Inventory" })).toBeInTheDocument();
  });

  it("has no menu button for mobile-first portals", () => {
    render(<Header portal="app" basePath="/app" />);
    expect(screen.queryByRole("button", { name: "Open navigation menu" })).not.toBeInTheDocument();
  });
});

describe("AppShell", () => {
  it("provides a skip link, a main landmark and the right navigation pattern", () => {
    render(
      <AppShell portal="app" basePath="/app" layout="mobile-first">
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveTextContent("content");
    expect(screen.getByRole("navigation", { name: "Home quick navigation" })).toBeInTheDocument();
  });

  it("omits the bottom bar for desktop-first portals", () => {
    render(
      <AppShell portal="provider" basePath="/provider" layout="desktop-first">
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole("navigation", { name: /quick navigation/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
  });
});

describe("Breadcrumbs & PageHeader", () => {
  it("renders an ordered breadcrumb trail with the current page", () => {
    render(
      <Breadcrumbs
        items={[{ label: "Home", href: "/app" }, { label: "Pets", href: "/app/pets" }, { label: "Bantay" }]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(3);
    expect(within(nav).getByText("Bantay")).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Pets" })).toHaveAttribute("href", "/app/pets");
  });

  it("renders nothing for an empty trail", () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a single h1 with description and actions", () => {
    render(
      <PageHeader
        title="Bills"
        description="Track what's due."
        actions={<button>Add bill</button>}
        eyebrow="Dela Cruz"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Bills" })).toBeInTheDocument();
    expect(screen.getByText("Track what's due.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add bill" })).toBeInTheDocument();
  });
});
