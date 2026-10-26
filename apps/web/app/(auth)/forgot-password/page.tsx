import Link from "next/link";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Reset your password</h1>
        <p className="mt-1 text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      {params.error === "link_device" && (
        <FormAlert message="Open the reset link on the same device and browser you requested it from, or request a new link here." />
      )}
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
