import { PlannedSection } from "@/components/layout/planned-section";

export default function Page({ params }: PageProps<"/admin/[...section]">) {
  return <PlannedSection portal="admin" params={params} />;
}
