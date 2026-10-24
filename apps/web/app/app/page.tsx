import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { CreateHouseholdForm } from "@/components/onboarding/create-household-form";
import { getMyContexts } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/session";
import { LAST_CONTEXT_COOKIE } from "@/lib/config/routes";

export const metadata = { title: "Your household" };

/** Resolves the household to open: last used (if still a member), otherwise the first; or onboarding. */
export default async function CustomerPortalEntry({ searchParams }: PageProps<"/app">) {
  const user = await requireUser("/app");
  const households = (await getMyContexts()).filter((c) => c.kind === "household");
  const creating = (await searchParams).new === "1";

  if (households.length > 0 && !creating) {
    const last = (await cookies()).get(LAST_CONTEXT_COOKIE.app)?.value;
    const target = households.find((h) => h.id === last) ?? households[0]!;
    redirect(`/app/h/${target.id}`);
  }

  return (
    <OnboardingCard
      user={user}
      title={households.length > 0 ? "Create another household" : "Set up your household"}
      description="A household is where your properties, family members, pets, vehicles and bills live. You can invite others later."
    >
      <CreateHouseholdForm />
    </OnboardingCard>
  );
}
