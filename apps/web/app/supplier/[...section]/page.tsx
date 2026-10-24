import { PlannedSection } from "@/components/layout/planned-section";

export default function Page({ params }: PageProps<"/supplier/[...section]">) {
  return <PlannedSection portal="supplier" params={params} />;
}
