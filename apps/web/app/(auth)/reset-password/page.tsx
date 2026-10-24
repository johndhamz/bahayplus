import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Choose a new password</h1>
        <p className="mt-1 text-muted-foreground">
          {user ? `For ${user.email}` : "Your reset link has expired or was already used."}
        </p>
      </div>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Link href="/forgot-password" className="font-semibold text-brand hover:underline">
          Request a new reset link
        </Link>
      )}
    </div>
  );
}
