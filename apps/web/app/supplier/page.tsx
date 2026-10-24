import { OrganizationPortalEntry } from "@/components/layout/organization-portal";

export default async function Page({ searchParams }: PageProps<"/supplier">) {
  return <OrganizationPortalEntry portal="supplier" creating={(await searchParams).new === "1"} />;
}
