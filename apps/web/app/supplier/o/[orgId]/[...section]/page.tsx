import { PlannedSection } from "@/components/layout/planned-section";

export default async function Page({ params }: PageProps<"/supplier/o/[orgId]/[...section]">) {
  const { orgId, section } = await params;
  return <PlannedSection portal="supplier" basePath={`/supplier/o/${orgId}`} section={section} />;
}
