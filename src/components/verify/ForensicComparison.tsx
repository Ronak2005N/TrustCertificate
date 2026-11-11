import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HashDisplay } from "@/components/common/HashDisplay";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PrototypeNotice } from "@/components/common/PrototypeNotice";
import type { ForensicResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ForensicComparison({
  result,
  className,
}: {
  result: ForensicResult;
  className?: string;
}) {
  const mismatch = result.outcome === "mismatch";
  const notFound = result.outcome === "not_found";
  const problem = mismatch || notFound;

  return (
    <div className={cn("space-y-5", className)}>
      <div
        className={cn(
          "glass-panel flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between",
          problem ? "border-destructive/25" : "border-success/25",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              problem ? "bg-destructive-muted text-destructive" : "bg-success-muted text-success",
            )}
          >
            {problem ? (
              <AlertTriangle className="size-5" aria-hidden />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {notFound
                ? "Certificate not found in the registry."
                : mismatch
                  ? "Potential tampering detected."
                  : "Document matches the registry."}
            </p>
            <p className="text-xs text-muted-foreground">
              {notFound
                ? "The certificate ID could not be located on Polygon Amoy or its stored metadata is unavailable."
                : mismatch
                  ? "The recomputed metadata fingerprint or an extracted field differs from the record anchored on-chain."
                  : "The metadata re-hashed from this document produces the exact fingerprint anchored on Polygon Amoy."}
            </p>
          </div>
        </div>
        <StatusBadge status={mismatch ? "Mismatch" : notFound ? "Not found" : "Match"} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Column
          title="Document"
          subtitle="Extracted from the uploaded file"
          rows={result.fields.map((f) => [f.label, f.document, f.match] as const)}
          hashLabel="Document byte hash (SHA-256 of file bytes)"
          hash={result.documentByteHash}
        />
        <Column
          title="Blockchain"
          subtitle="Registered in CertChainRegistry"
          rows={result.fields.map((f) => [f.label, f.registry, true] as const)}
          hashLabel="Certificate fingerprint (on-chain)"
          hash={result.registeredHash ?? "—"}
        />
      </div>

      {result.certificate && !mismatch && (
        <Button asChild variant="outline">
          <Link to="/certificate/$id" params={{ id: result.certificate.id }}>
            Open certificate detail
          </Link>
        </Button>
      )}

      <PrototypeNotice />
    </div>
  );
}

function Column({
  title,
  subtitle,
  rows,
  hashLabel,
  hash,
}: {
  title: string;
  subtitle: string;
  rows: readonly (readonly [string, string, boolean])[];
  hashLabel: string;
  hash: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([label, value, ok]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "text-right",
                ok ? "text-foreground" : "font-medium text-destructive",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <HashDisplay className="mt-4" label={hashLabel} value={hash} />
    </section>
  );
}
