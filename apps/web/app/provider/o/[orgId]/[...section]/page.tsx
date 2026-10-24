import { PlannedSection } from "@/components/layout/planned-section";

export default async function Page({ params }: PageProps<"/provider/o/[orgId]/[...section]">) {
  const { orgId, section } = await params;
  return <PlannedSection portal="provider" basePath={`/provider/o/${orgId}`} section={section} />;
}
