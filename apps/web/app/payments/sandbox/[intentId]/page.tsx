import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { getPayment } from "@bahayplus/modules/payments";
import { formatPeso } from "@bahayplus/types/money";
import { AccountFrame } from "@/components/account/account-frame";
import { SandboxCheckout } from "@/components/payments/payment-forms";
import { requireServiceContext } from "@/lib/auth/context";
import { sandboxProvider } from "@/lib/payments/provider";

export const metadata = { title: "Sandbox checkout" };

/** LOCAL SANDBOX checkout. Exists only when the sandbox provider is enabled (local/test). Moves no money. */
export default async function SandboxCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ intentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!sandboxProvider()) notFound();
  const { intentId } = await params;
  const sp = await searchParams;
  const ctx = await requireServiceContext(`/payments/sandbox/${intentId}`);
  const intent = await getPayment(ctx, intentId);
  if (!intent.ok) notFound();
  const back =
    typeof sp.return === "string" && sp.return.startsWith("/") && !sp.return.startsWith("//") ? sp.return : "/app";
  return (
    <AccountFrame
      title="Sandbox checkout"
      description="Local development only. No real money moves and nothing is charged."
    >
      <div
        role="note"
        aria-label="Sandbox notice"
        className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm"
      >
        <FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong>This is the Bahay+ payment sandbox.</strong> It stands in for a licensed payment provider during
          development. Your choice below is delivered as a signed provider webhook and verified on the server, exactly
          like a real payment.
        </p>
      </div>
      <section
        aria-labelledby="pay-heading"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="pay-heading" className="text-lg font-semibold">
          {intent.value.description}
        </h2>
        <p className="text-3xl font-bold tabular-nums">{formatPeso(intent.value.amountCentavos)}</p>
        {intent.value.status === "processing" ? (
          <SandboxCheckout paymentIntentId={intentId} returnPath={back} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This payment is no longer awaiting checkout ({intent.value.status.replace("_", " ")}).
          </p>
        )}
      </section>
    </AccountFrame>
  );
}
