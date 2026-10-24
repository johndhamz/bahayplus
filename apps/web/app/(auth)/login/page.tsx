import Link from "next/link";
import { safeNextPath } from "@/lib/config/routes";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Welcome back</h1>
        <p className="mt-1 text-muted-foreground">Log in to manage your home.</p>
      </div>
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New to Bahay+?{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
