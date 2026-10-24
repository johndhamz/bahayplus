import { OrganizationPortalEntry } from "@/components/layout/organization-portal";

export default async function Page({ searchParams }: PageProps<"/provider">) {
  return <OrganizationPortalEntry portal="provider" creating={(await searchParams).new === "1"} />;
}
