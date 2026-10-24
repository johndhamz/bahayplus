import { getHouseholdInvitation } from "@bahayplus/modules/households";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { AcceptInvitationButton } from "@/components/onboarding/accept-invitation";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { acceptHouseholdInvitationAction } from "@/lib/actions/households";
import { requireServiceContext } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/session";
import { roleLabel } from "@/lib/config/roles";
import { formatManilaDateTime } from "@bahayplus/types/dates";

export const metadata = { title: "Household invitation", referrer: "no-referrer" };

export default async function HouseholdInvitationPage({ searchParams }: PageProps<"/invite/household">) {
  const token = String((await searchParams).token ?? "");
  const user = await requireUser(`/invite/household?token=${encodeURIComponent(token)}`);
  const ctx = await requireServiceContext("/app");
  const preview = await getHouseholdInvitation(ctx, { token });

  if (!preview.ok) {
    return (
      <OnboardingCard user={user} title="Invitation not found" description="This invitation link is not valid.">
        <FormAlert message="Ask the person who invited you to send a new link." />
      </OnboardingCard>
    );
  }
  const invite = preview.value;
  const usable = invite.status === "pending";
  const wrongAccount = invite.invitedEmail !== user.email?.toLowerCase();
  return (
    <OnboardingCard
      user={user}
      title={`Join ${invite.householdName}`}
      description={
        <>
          You&apos;ve been invited as <strong>{roleLabel("household", invite.role)}</strong>. Invitation for{" "}
          {invite.invitedEmail}, valid until {formatManilaDateTime(invite.expiresAt)}.
        </>
      }
    >
      {!usable ? (
        <FormAlert
          message={
            invite.status === "accepted"
              ? "This invitation has already been used."
              : "This invitation has expired or was cancelled."
          }
        />
      ) : wrongAccount ? (
        <FormAlert message={`You're signed in as ${user.email}. Sign in with ${invite.invitedEmail} to accept.`} />
      ) : (
        <AcceptInvitationButton
          token={token}
          accept={acceptHouseholdInvitationAction}
          redirectTo={(d) => ("householdId" in d ? `/app/h/${d.householdId}` : "/app")}
        />
      )}
    </OnboardingCard>
  );
}
