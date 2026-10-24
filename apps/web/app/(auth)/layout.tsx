import { BrandMark } from "@/components/layout/brand-mark";
import { SITE } from "@/lib/config/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-brand-foreground lg:flex">
        <BrandMark tone="light" />
        <div>
          <p className="font-heading text-4xl leading-tight font-bold">{SITE.tagline}</p>
          <p className="mt-3 max-w-md text-brand-foreground/80">
            Bills, maintenance, pets, vehicles and trusted home services — organized for your whole household.
          </p>
        </div>
        <p className="text-sm text-brand-foreground/70">Made for Filipino homes.</p>
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
