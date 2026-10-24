import { BadgeCheck, CalendarDays, Car, PawPrint, Receipt, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@bahayplus/ui/components/ui/button";
import { SERVICE_DIVISIONS } from "@/lib/config/service-catalog";
import { SITE } from "@/lib/config/site";

const FEATURES = [
  {
    icon: Receipt,
    title: "Bills & budget",
    body: "Track Meralco, water, internet and dues. See what's due before it's late.",
  },
  {
    icon: CalendarDays,
    title: "One household calendar",
    body: "Maintenance, vet visits, LTO renewals and bookings in one view.",
  },
  { icon: PawPrint, title: "Pets & vehicles", body: "Vaccination records, service history and expiry reminders." },
  {
    icon: Wrench,
    title: "Trusted home services",
    body: "Find providers, compare quotes and book — with verification you can read.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </nav>
      </header>

      <main id="main-content">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div className="flex flex-col gap-5">
            <p className="w-fit rounded-full bg-sage px-3 py-1 text-sm font-semibold text-brand">
              Made for Filipino homes
            </p>
            <h1 className="text-4xl leading-tight font-extrabold text-brand sm:text-5xl">{SITE.tagline}</h1>
            <p className="max-w-lg text-lg text-muted-foreground">{SITE.description}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">Create your free account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-4 text-brand" />
              Your household data stays private to your household.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                <span className="mb-3 grid size-11 place-items-center rounded-xl bg-sage text-brand">
                  <f.icon aria-hidden="true" className="size-5" />
                </span>
                <h2 className="font-heading font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="divisions" className="bg-brand py-12 text-brand-foreground">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="divisions" className="text-2xl font-bold">
              Services for every part of home
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICE_DIVISIONS.map((d) => (
                <li key={d.id} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <p className="font-heading font-semibold text-gold">{d.label}</p>
                  <p className="mt-1 text-sm text-brand-foreground/85">{d.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <Car aria-hidden="true" className="mb-3 size-6 text-terracotta" />
            <h2 className="text-xl font-bold">For service providers & suppliers</h2>
            <p className="mt-2 text-muted-foreground">
              Run bookings, quotations, work orders, staff and inventory from one business portal.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/signup?intent=business">Register your business</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <BadgeCheck aria-hidden="true" className="mb-3 size-6 text-terracotta" />
            <h2 className="text-xl font-bold">Verification you can read</h2>
            <p className="mt-2 text-muted-foreground">
              Badges say exactly what Bahay+ checked — business permits, IDs or licences — never a vague
              &ldquo;trusted&rdquo;.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {SITE.name}. {SITE.tagline}
      </footer>
    </div>
  );
}
