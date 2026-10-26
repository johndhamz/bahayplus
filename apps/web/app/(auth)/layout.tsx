import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BrandMark } from "@/components/layout/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-brand-foreground lg:flex">
        <span />
        <div className="relative z-10">
          <Link href="/" className="inline-block rounded-md">
            <Logo tone="inverse" size="lg" tagline />
          </Link>
          <p className="mt-8 max-w-md text-lg text-brand-foreground/85">
            Bills, maintenance, pets, vehicles and trusted home services — organized for your whole household.
          </p>
        </div>
        <p className="relative z-10 text-sm text-brand-foreground/70">Made for Filipino homes.</p>
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-96 rounded-full bg-gold/15" />
      </aside>
      <main id="main-content" className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 lg:hidden">
          <BrandMark />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
