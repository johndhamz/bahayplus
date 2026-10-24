export const SITE = {
  name: "Bahay+",
  tagline: "Everything home. One app.",
  description:
    "Bahay+ is the Philippines-first home operating system: manage your household, properties, pets, vehicles, bills and trusted home service providers in one place.",
  supportEmail: "support@bahayplus.ph",
  /** Official national emergency hotline (Philippines). Shown wherever urgent help is offered. */
  emergencyHotline: "911",
} as const;

/** Design preview routes (sample data) are never served in production unless explicitly enabled. */
export function designPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DESIGN_PREVIEW === "true";
}
