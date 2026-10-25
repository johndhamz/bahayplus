import Link from "next/link";
import { BILL_TYPE_LABELS, periodLabel, type BillView } from "@bahayplus/modules/bills";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";

export function BillRow({ bill, href }: { bill: BillView; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/60">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{bill.accountLabel}</p>
        <p className="text-xs text-muted-foreground">
          {BILL_TYPE_LABELS[bill.billType]} · {periodLabel(bill.periodKey)} · due {formatManilaDate(bill.dueOn)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">
          {bill.amountDueCentavos === null ? "—" : formatPeso(bill.remainingCentavos ?? bill.amountDueCentavos)}
        </span>
        <StatusBadge
          status={bill.displayStatus}
          label={bill.displayStatus === "awaiting_amount" ? "Needs amount" : undefined}
        />
      </div>
    </Link>
  );
}
