import { PlannedSection } from "@/components/layout/planned-section";

export default function Page({ params }: PageProps<"/provider/[...section]">) {
  return <PlannedSection portal="provider" params={params} />;
}
