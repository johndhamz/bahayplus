import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import { designPreviewEnabled } from "@/lib/config/site";

export const metadata = { title: "Design preview", robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (!designPreviewEnabled()) notFound();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <BrandMark href="/preview" />
          <nav aria-label="Preview pages" className="flex gap-3 overflow-x-auto text-sm font-medium">
            <Link href="/preview" className="whitespace-nowrap hover:underline">
              Components
            </Link>
            <Link href="/preview/customer" className="whitespace-nowrap hover:underline">
              Customer
            </Link>
            <Link href="/preview/business" className="whitespace-nowrap hover:underline">
              Business
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
