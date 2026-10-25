"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ReconciliationItemView } from "@bahayplus/modules/payments";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { Textarea } from "@bahayplus/ui/components/ui/textarea";
import { formatPeso } from "@bahayplus/types/money";
import { selectClassName } from "@/components/forms/fields";
import {
  createSettlementAction,
  runReconciliationAction,
  setCommissionRateAction,
  updateSettlementAction,
} from "@/lib/actions/payments";

export function CreateSettlementForm({
  organizations,
  today,
}: {
  organizations: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [org, setOrg] = useState(organizations[0]?.id ?? "");
  const [periodEnd, setPeriodEnd] = useState(today);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createSettlementAction({ organizationId: org, periodEnd });
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("Settlement created.");
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
        Business
        <select className={selectClassName} value={org} onChange={(e) => setOrg(e.target.value)}>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Period ends
        <Input type="date" value={periodEnd} max={today} onChange={(e) => setPeriodEnd(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending || !org}>
        Create settlement
      </Button>
    </form>
  );
}

export function SettlementActions({
  settlementId,
  status,
}: {
  settlementId: string;
  status: "draft" | "approved" | "paid_out";
}) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [pending, start] = useTransition();
  const act = (next: "approved" | "paid_out") =>
    start(async () => {
      const r = await updateSettlementAction({ settlementId, status: next, payoutReference: ref });
      if (!r.ok) return void toast.error(r.error.message);
      router.refresh();
    });
  if (status === "draft")
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => act("approved")}>
        Approve
      </Button>
    );
  if (status === "approved")
    return (
      <div className="flex gap-2">
        <Input
          aria-label="Partner payout reference"
          placeholder="Payout reference"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          className="h-9 w-44"
        />
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act("paid_out")}>
          Record payout
        </Button>
      </div>
    );
  return null;
}

const RESULT_TONE: Record<string, "success" | "danger" | "warning"> = {
  matched: "success",
  amount_mismatch: "danger",
  status_mismatch: "warning",
  missing_in_ledger: "danger",
  missing_at_provider: "warning",
};

export function ReconciliationForm({ today }: { today: string }) {
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [report, setReport] = useState(
    '[\n  { "external_reference": "sbx_pi_...", "amount_centavos": 150000, "status": "succeeded" }\n]',
  );
  const [result, setResult] = useState<{ matched: number; mismatched: number; items: ReconciliationItemView[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          let rows: unknown;
          try {
            rows = JSON.parse(report);
          } catch {
            return setError("The report must be valid JSON (a list of transactions).");
          }
          start(async () => {
            const r = await runReconciliationAction({ provider: "sandbox", from, to, report: rows });
            if (!r.ok) return setError(r.error.message);
            setResult(r.data);
          });
        }}
      >
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Provider transaction report (JSON)
          <Textarea rows={6} value={report} onChange={(e) => setReport(e.target.value)} className="font-mono text-xs" />
        </label>
        <Button type="submit" disabled={pending} className="w-fit">
          Run reconciliation
        </Button>
      </form>
      {result && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {result.matched} matched · {result.mismatched} need attention
          </p>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {result.items.map((i) => (
              <li key={i.externalReference} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1 truncate font-mono text-xs">{i.externalReference}</span>
                <span className="text-xs text-muted-foreground">
                  provider {i.providerAmountCentavos !== null ? formatPeso(i.providerAmountCentavos) : "—"}{" "}
                  {i.providerStatus ?? ""} · ledger{" "}
                  {i.ledgerAmountCentavos !== null ? formatPeso(i.ledgerAmountCentavos) : "—"} {i.ledgerStatus ?? ""}
                </span>
                <StatusBadge status={i.result} tone={RESULT_TONE[i.result]} label={i.result.replaceAll("_", " ")} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CommissionForm({
  organizations,
  today,
  currentDefaultBps,
}: {
  organizations: { id: string; name: string }[];
  today: string;
  currentDefaultBps: number;
}) {
  const router = useRouter();
  const [org, setOrg] = useState("");
  const [rate, setRate] = useState(String(currentDefaultBps / 100));
  const [from, setFrom] = useState(today);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const bps = Math.round(Number(rate) * 100);
          const r = await setCommissionRateAction({ organizationId: org, rateBps: bps, effectiveFrom: from, note: "" });
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("Commission rate saved.");
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
        Applies to
        <select className={selectClassName} value={org} onChange={(e) => setOrg(e.target.value)}>
          <option value="">Platform default</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Rate (%)
        <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="w-24" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Effective from
        <Input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        Save rate
      </Button>
    </form>
  );
}
