import {
  Activity,
  BadgeCheck,
  Boxes,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Gauge,
  Hammer,
  History,
  HardHat,
  House,
  Images,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  PawPrint,
  Receipt,
  ScrollText,
  ShoppingCart,
  Settings,
  Star,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { Portal } from "./routes";

export type NavItem = {
  /** Path relative to the portal's context base, "" for the portal home. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (customer/worker portals; max 4 + "More"). */
  primary?: boolean;
};

export type NavSection = { label?: string; items: NavItem[] };

export const PORTAL_LABEL: Record<Portal, string> = {
  app: "Home",
  provider: "Provider",
  supplier: "Supplier",
  worker: "Field Worker",
  admin: "Admin",
};

export const PORTAL_NAV: Record<Portal, NavSection[]> = {
  app: [
    {
      items: [
        { path: "", label: "Home", icon: House, primary: true },
        { path: "calendar", label: "Calendar", icon: CalendarDays, primary: true },
        { path: "services", label: "Services", icon: Wrench, primary: true },
        { path: "bills", label: "Bills", icon: Receipt, primary: true },
      ],
    },
    {
      label: "Household",
      items: [
        { path: "properties", label: "Properties", icon: Building2 },
        { path: "members", label: "Members", icon: Users },
        { path: "assets", label: "Assets", icon: Package },
        { path: "pets", label: "Pets", icon: PawPrint },
        { path: "vehicles", label: "Vehicles", icon: Car },
        { path: "budget", label: "Budget", icon: Wallet },
        { path: "bookings", label: "Bookings", icon: ClipboardList },
        { path: "projects", label: "Projects", icon: Hammer },
        { path: "settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  provider: [
    {
      items: [
        { path: "", label: "Dashboard", icon: LayoutDashboard },
        { path: "bookings", label: "Bookings", icon: ClipboardList },
        { path: "quotations", label: "Quotations", icon: FileText },
        { path: "work-orders", label: "Work orders", icon: HardHat },
        { path: "projects", label: "Projects", icon: Hammer },
        { path: "history", label: "Job history", icon: History },
        { path: "purchasing", label: "Purchasing", icon: ShoppingCart },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { path: "profile", label: "Business profile", icon: Store },
        { path: "services", label: "Services & pricing", icon: Tags },
        { path: "coverage", label: "Coverage areas", icon: MapPin },
        { path: "portfolio", label: "Portfolio", icon: Images },
        { path: "verification", label: "Verification", icon: BadgeCheck },
        { path: "reviews", label: "Reviews", icon: Star },
      ],
    },
    {
      label: "Business",
      items: [
        { path: "staff", label: "Staff", icon: Users },
        { path: "finance", label: "Financial summary", icon: Wallet },
        { path: "settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  supplier: [
    {
      items: [
        { path: "", label: "Dashboard", icon: LayoutDashboard },
        { path: "products", label: "Products", icon: Package },
        { path: "inventory", label: "Inventory", icon: Boxes },
        { path: "purchase-orders", label: "Purchase orders", icon: ClipboardList },
        { path: "deliveries", label: "Deliveries", icon: Truck },
      ],
    },
    {
      label: "Business",
      items: [
        { path: "reports", label: "Reports", icon: Activity },
        { path: "profile", label: "Supplier profile", icon: Store },
        { path: "staff", label: "Staff", icon: Users },
      ],
    },
  ],
  worker: [
    {
      items: [
        { path: "", label: "Today", icon: Gauge, primary: true },
        { path: "jobs", label: "Jobs", icon: HardHat, primary: true },
        { path: "schedule", label: "Schedule", icon: CalendarDays, primary: true },
      ],
    },
  ],
  admin: [
    {
      items: [
        { path: "", label: "Overview", icon: LayoutDashboard },
        { path: "verifications", label: "Verification queue", icon: BadgeCheck },
        { path: "organizations", label: "Organizations", icon: Building2 },
        { path: "users", label: "Users", icon: Users },
        { path: "categories", label: "Service categories", icon: Tags },
        { path: "disputes", label: "Disputes", icon: ScrollText },
        { path: "audit", label: "Audit log", icon: Activity },
        { path: "settings", label: "Platform settings", icon: Settings },
      ],
    },
  ],
};

export function navHref(basePath: string, path: string): string {
  return path ? `${basePath.replace(/\/$/, "")}/${path}` : basePath;
}

/** Active when the pathname is the item itself or a descendant (home only matches exactly). */
export function isNavActive(pathname: string, basePath: string, path: string): boolean {
  const href = navHref(basePath, path);
  if (!path) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
