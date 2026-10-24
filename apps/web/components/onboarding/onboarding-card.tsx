import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { UserMenu } from "@/components/layout/user-menu";

/** Centered single-task layout used before a user has any context in a portal. */
export function OnboardingCard({
  title,
  description,
  children,
  user,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  user: { email: string | null };
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <UserMenu displayName={user.email?.split("@")[0] ?? "Account"} email={user.email} />
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold text-brand">{title}</h1>
          <div className="mt-1 mb-6 text-muted-foreground">{description}</div>
          {children}
        </div>
      </main>
    </div>
  );
}
