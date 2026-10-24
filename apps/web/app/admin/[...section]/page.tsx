import { PlannedSection } from "@/components/layout/planned-section";

export default async function Page({ params }: PageProps<"/admin/[...section]">) {
  const { section } = await params;
  return <PlannedSection portal="admin" basePath="/admin" section={section} />;
}
