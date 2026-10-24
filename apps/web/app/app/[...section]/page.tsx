import { PlannedSection } from "@/components/layout/planned-section";

export default function Page({ params }: PageProps<"/app/[...section]">) {
  return <PlannedSection portal="app" params={params} />;
}
