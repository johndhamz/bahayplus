import {
  Bug,
  Car,
  Droplets,
  Hammer,
  KeyRound,
  Leaf,
  type LucideIcon,
  PaintRoller,
  PawPrint,
  Plug,
  Scissors,
  Siren,
  Sofa,
  Sparkles,
  Stethoscope,
  Wind,
  Wrench,
} from "lucide-react";

/**
 * Platform service taxonomy (reference data, not sample data). The database copy seeded in a later
 * phase is the source of truth at runtime; this list drives navigation and quick entry points.
 */
export type ServiceDivision = "home" | "pet" | "vehicle" | "renovation";

export const SERVICE_DIVISIONS: { id: ServiceDivision; label: string; description: string }[] = [
  { id: "home", label: "Home Services", description: "Repairs, cleaning and upkeep" },
  { id: "pet", label: "Pet Care", description: "Grooming, vet visits and pet sitting" },
  { id: "vehicle", label: "Vehicle Care", description: "Maintenance, cleaning and roadside help" },
  { id: "renovation", label: "Renovation & Custom Projects", description: "Renovation, carpentry and furniture" },
];

export type QuickCategory = {
  slug: string;
  label: string;
  division: ServiceDivision;
  icon: LucideIcon;
  urgentEligible?: boolean;
};

export const QUICK_CATEGORIES: QuickCategory[] = [
  { slug: "plumbing", label: "Plumbing", division: "home", icon: Droplets, urgentEligible: true },
  { slug: "electrical", label: "Electrical", division: "home", icon: Plug, urgentEligible: true },
  { slug: "aircon", label: "Aircon", division: "home", icon: Wind },
  { slug: "cleaning", label: "Cleaning", division: "home", icon: Sparkles },
  { slug: "pest-control", label: "Pest control", division: "home", icon: Bug },
  { slug: "locksmith", label: "Locksmith", division: "home", icon: KeyRound, urgentEligible: true },
  { slug: "gardening", label: "Gardening", division: "home", icon: Leaf },
  { slug: "appliance-repair", label: "Appliance repair", division: "home", icon: Wrench },
  { slug: "pet-grooming", label: "Grooming", division: "pet", icon: Scissors },
  { slug: "vet-home-visit", label: "Vet visit", division: "pet", icon: Stethoscope },
  { slug: "pet-sitting", label: "Pet sitting", division: "pet", icon: PawPrint },
  { slug: "car-maintenance", label: "Car service", division: "vehicle", icon: Car },
  { slug: "roadside-assistance", label: "Roadside help", division: "vehicle", icon: Siren, urgentEligible: true },
  { slug: "renovation", label: "Renovation", division: "renovation", icon: Hammer },
  { slug: "painting", label: "Painting", division: "renovation", icon: PaintRoller },
  { slug: "custom-furniture", label: "Furniture & cabinetry", division: "renovation", icon: Sofa },
];
