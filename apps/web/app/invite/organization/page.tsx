import { getOrganizationInvitation } from "@bahayplus/modules/organizations";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { AcceptInvitationButton } from "@/components/onboarding/accept-invitation";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { acceptOrganizationInvitationAction } from "@/lib/actions/organizations";
import { requireServiceContext } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/session";
import { roleLabel } from "@/lib/config/roles";
import { formatManilaDateTime } from "@bahayplus/types/dates";

export const metadata = { title: "Team invitation", referrer: "no-referrer" };

export default async function OrganizationInvitationPage({ searchParams }: PageProps<"/invite/organization">) {
  const token = String((await searchParams).token ?? "");
  const user = await requireUser(`/invite/organization?token=${encodeURIComponent(token)}`);
  const ctx = await requireServiceContext("/app");
  const preview = await getOrganizationInvitation(ctx, { token });

  if (!preview.ok) {
    return (
      <OnboardingCard user={user} title="Invitation not found" description="This invitation link is not valid.">
        <FormAlert message="Ask the business that invited you to send a new link." />
      </OnboardingCard>
    );
  }
  const invite = preview.value;
  const usable = invite.status === "pending";
  const wrongAccount = invite.invitedEmail !== user.email?.toLowerCase();
  const portal =
    invite.role === "worker"
      ? "/worker"
      : invite.organizationKind === "service_provider"
        ? "/provider/o/"
        : "/supplier/o/";
  return (
    <OnboardingCard
      user={user}
      title={`Join ${invite.organizationName}`}
      description={
        <>
          You&apos;ve been invited as <strong>{roleLabel("organization", invite.role)}</strong>. Invitation for{" "}
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
          accept={acceptOrganizationInvitationAction}
          redirectTo={(d) => ("organizationId" in d && portal.endsWith("/") ? `${portal}${d.organizationId}` : portal)}
        />
      )}
    </OnboardingCard>
  );
}
