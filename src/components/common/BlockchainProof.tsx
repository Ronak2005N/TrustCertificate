import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HashDisplay } from "./HashDisplay";
import { explorerTx, formatDateTime, shorten } from "@/lib/certificates";
import type { BlockchainRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BlockchainProof({
  record,
  variant = "issue",
  className,
}: {
  record: BlockchainRecord;
  variant?: "issue" | "revoke";
  className?: string;
}) {
  const tx =
    variant === "revoke" && record.revocationTransactionHash
      ? record.revocationTransactionHash
      : record.transactionHash;

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <h2 className="text-sm font-semibold text-foreground">
        {variant === "revoke" ? "Revocation record" : "Blockchain proof"}
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Network" value={record.network} />
        <Row label="Contract" value={record.contract} />
        <Row label="Block" value={`#${record.block.toLocaleString("en-US")}`} mono />
        <Row
          label={variant === "revoke" ? "Revoked" : "Confirmed"}
          value={formatDateTime(
            variant === "revoke" ? (record.revokedAt ?? record.confirmedAt) : record.confirmedAt,
          )}
        />
      </dl>

      <div className="mt-4 space-y-3">
        <HashDisplay
          label="Issuer wallet"
          value={record.issuerWallet}
          toastMessage="Issuer wallet copied"
        />
        <HashDisplay label="Transaction" value={tx} toastMessage="Transaction hash copied" />
      </div>

      <Button asChild variant="outline" className="mt-4 w-full">
        <a href={explorerTx(tx)} target="_blank" rel="noreferrer noopener">
          View on PolygonScan
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-right text-foreground", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

export function TransactionCard({ record }: { record: BlockchainRecord }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <code className="truncate font-mono text-xs text-foreground">
          {shorten(record.transactionHash, 12, 8)}
        </code>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Confirmed
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <span>{record.network}</span>
        <span className="font-mono">Block #{record.block.toLocaleString("en-US")}</span>
        <span className="col-span-2 sm:col-span-1">{formatDateTime(record.confirmedAt)}</span>
      </div>
      <a
        href={explorerTx(record.transactionHash)}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        View on PolygonScan <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
