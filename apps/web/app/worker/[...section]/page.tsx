import { PlannedSection } from "@/components/layout/planned-section";

export default function Page({ params }: PageProps<"/worker/[...section]">) {
  return <PlannedSection portal="worker" params={params} />;
}
