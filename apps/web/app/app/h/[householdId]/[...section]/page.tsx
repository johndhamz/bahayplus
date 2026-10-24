import { PlannedSection } from "@/components/layout/planned-section";

export default async function Page({ params }: PageProps<"/app/h/[householdId]/[...section]">) {
  const { householdId, section } = await params;
  return <PlannedSection portal="app" basePath={`/app/h/${householdId}`} section={section} />;
}
