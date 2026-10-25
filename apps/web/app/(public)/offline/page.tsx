import { WifiOff } from "lucide-react";
import Link from "next/link";
import { SITE } from "@/lib/config/site";

export const metadata = { title: "You're offline" };
export const dynamic = "force-static";

/** Static fallback shown by the service worker when a page can't load. Contains no user data. */
export default function OfflinePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <span className="grid size-16 place-items-center rounded-full bg-sage text-brand">
        <WifiOff aria-hidden="true" className="size-8" />
      </span>
      <h1 className="text-2xl font-bold text-brand">You&apos;re offline</h1>
      <p className="text-muted-foreground">
        Bahay+ needs a connection to show your household&apos;s latest information. Check your mobile data or Wi-Fi,
        then try again.
      </p>
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-brand-foreground"
      >
        Try again
      </Link>
      <p className="text-xs text-muted-foreground">
        Emergency? Call{" "}
        <a href={`tel:${SITE.emergencyHotline}`} className="font-semibold underline">
          {SITE.emergencyHotline}
        </a>{" "}
        — it works without data.
      </p>
    </main>
  );
}
