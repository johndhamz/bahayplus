import { notFound, redirect } from "next/navigation";
import { loadPlatformAccess } from "@bahayplus/modules/authorization";
import { Button } from "@bahayplus/ui/components/ui/button";
import { requireServiceContext } from "@/lib/auth/context";
import { signOutAction } from "@/lib/actions/identity";
import { safeNextPath } from "@/lib/config/routes";
import { MfaEnrollment, MfaVerifyForm } from "./mfa-forms";

export const metadata = { title: "Two-step verification" };

/** Second factor for platform admins: enroll an authenticator app once, then enter a code each sign-in. */
export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined, "/admin");
  const ctx = await requireServiceContext("/mfa");
  if (!(await loadPlatformAccess(ctx)).ok) notFound();

  const { data: aal } = await ctx.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect(next);
  const { data: factors } = await ctx.db.auth.mfa.listFactors();
  const factor = factors?.totp[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Two-step verification</h1>
        <p className="mt-1 text-muted-foreground">
          {factor
            ? "Enter the 6-digit code from your authenticator app to open the admin portal."
            : "Admin accounts need an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, …). Set it up once; you'll enter a code each time you sign in."}
        </p>
      </div>
      {factor ? <MfaVerifyForm factorId={factor.id} next={next} /> : <MfaEnrollment next={next} />}
      <form action={signOutAction} className="text-center">
        <Button type="submit" variant="link" className="text-muted-foreground">
          Sign out instead
        </Button>
      </form>
    </div>
  );
}
