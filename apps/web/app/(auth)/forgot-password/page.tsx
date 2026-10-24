import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Reset your password</h1>
        <p className="mt-1 text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
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
