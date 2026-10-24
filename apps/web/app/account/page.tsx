import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyProfile } from "@bahayplus/modules/identity";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { BrandMark } from "@/components/layout/brand-mark";
import { requireServiceContext } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm, ProfileForm } from "./account-forms";

export const metadata = { title: "Profile & security" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const ctx = await requireServiceContext("/account");
  const profile = await getMyProfile(ctx);
  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
        <BrandMark />
      </header>
      <main id="main-content" className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <Link
          href="/app"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to Bahay+
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-brand">Profile & security</h1>
          <p className="mt-1 text-muted-foreground">Signed in as {user.email}</p>
        </div>
        {profile.ok ? (
          <>
            <section
              aria-labelledby="profile-heading"
              className="rounded-2xl border border-border bg-surface p-5 shadow-card"
            >
              <h2 id="profile-heading" className="mb-4 text-lg font-semibold">
                Profile
              </h2>
              <ProfileForm profile={profile.value} />
            </section>
            <section
              aria-labelledby="password-heading"
              className="rounded-2xl border border-border bg-surface p-5 shadow-card"
            >
              <h2 id="password-heading" className="mb-4 text-lg font-semibold">
                Change password
              </h2>
              <ChangePasswordForm />
            </section>
          </>
        ) : (
          <ErrorState description="We couldn't load your profile." />
        )}
      </main>
    </div>
  );
}
