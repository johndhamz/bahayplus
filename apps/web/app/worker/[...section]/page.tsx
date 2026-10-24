import { PlannedSection } from "@/components/layout/planned-section";

export default async function Page({ params }: PageProps<"/worker/[...section]">) {
  const { section } = await params;
  return <PlannedSection portal="worker" basePath="/worker" section={section} />;
}
