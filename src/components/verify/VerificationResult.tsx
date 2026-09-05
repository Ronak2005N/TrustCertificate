import { Link } from "@tanstack/react-router";
import { AlertOctagon, ArrowRight, CheckCircle2, ExternalLink, SearchX, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HashDisplay } from "@/components/common/HashDisplay";
import { BlockchainProof } from "@/components/common/BlockchainProof";
import { StatusBadge } from "@/components/common/StatusBadge";
import { explorerTx, formatDate, formatDateTime, shorten } from "@/lib/certificates";
import type { VerificationResult as Result } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VerificationResultView({ result }: { result: Result }) {
  if (result.outcome === "error") return <VerificationError result={result} />;
  if (result.outcome === "not_found") return <NotFound hash={result.hash} />;
  const cert = result.certificate!;
  const revoked = result.outcome === "revoked";

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "glass-panel rounded-2xl p-6 text-center sm:p-8",
          revoked ? "border-destructive/25" : "border-success/25",
        )}
      >
        <span
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            revoked ? "bg-destructive-muted text-destructive" : "bg-success-muted text-success",
          )}
        >
          {revoked ? (
            <AlertOctagon className="size-7" aria-hidden />
          ) : (
            <CheckCircle2 className="size-7" aria-hidden />
          )}
        </span>
        <p
          className={cn(
            "mt-4 text-xs font-semibold tracking-[0.2em] uppercase",
            revoked ? "text-destructive" : "text-success",
          )}
        >
          {revoked ? "Certificate revoked" : "Certificate verified"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          {revoked ? "This certificate is no longer valid." : "Authentic blockchain record found"}
        </h2>
        {revoked && (
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            The certificate hash exists on-chain, but the issuer has recorded a revocation event.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/certificate/$id" params={{ id: cert.id }}>
              Open certificate detail <ArrowRight className="size-4" />
            </Link>
          </Button>
          {cert.chain.transactionHash && (
            <Button asChild variant="outline" size="sm">
              <a href={explorerTx(cert.chain.transactionHash)} target="_blank" rel="noreferrer noopener">
                View on PolygonScan <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const url = `${window.location.origin}/verify/${cert.hash}`;
              await navigator.clipboard.writeText(url);
              toast.success("Verification link copied");
            }}
          >
            <Share2 className="size-4" /> Share
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <h3 className="text-sm font-semibold text-foreground">Certificate details</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Recipient" value={cert.recipientName || "Not available"} />
            <Row label="Certificate type" value={cert.type} />
            <Row label="Course / programme" value={cert.course || "Not available"} />
            <Row label="Issuing organization" value={cert.organization} />
            <Row label="Issue date" value={formatDate(cert.issueDate)} />
            <Row label="Certificate ID" value={cert.id} mono />
            {revoked && cert.chain.revokedAt && (
              <Row label="Revoked on" value={formatDateTime(cert.chain.revokedAt)} />
            )}
            <div className="flex items-center justify-between gap-4 pt-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={revoked ? "Revoked" : "Active"} />
              </dd>
            </div>
          </dl>
          <div className="mt-5 space-y-3">
            <HashDisplay label="Certificate hash" value={cert.hash} />
            <HashDisplay
              label="Issuer wallet"
              value={cert.chain.issuerWallet}
              toastMessage="Issuer wallet copied"
            />
          </div>
        </section>

        <div className="space-y-6">
          <BlockchainProof record={cert.chain} variant={revoked ? "revoke" : "issue"} />

          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="text-sm font-semibold text-foreground">Verification integrity</h3>
            <ul className="mt-4 space-y-2.5">
              {result.checks.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <StatusBadge status={c.value} tone={c.pass ? "success" : "danger"} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function VerificationError({ result }: { result: Result }) {
  const err = result.error;
  return (
    <section className="rounded-2xl border border-destructive/25 bg-card p-8 text-center shadow-soft">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive-muted text-destructive">
        <AlertOctagon className="size-7" aria-hidden />
      </span>
      <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-destructive uppercase">
        Verification Error
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-foreground">
        {err?.type === "invalid_hash"
          ? "Invalid certificate hash"
          : err?.type === "not_found"
            ? "Certificate not found"
            : "Unable to verify certificate"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {err?.message || "An unexpected error occurred."}
      </p>
      {result.hash && (
        <code className="mt-4 inline-block rounded-lg border bg-muted px-3 py-1.5 font-mono text-xs text-foreground">
          {shorten(result.hash, 14, 8)}
        </code>
      )}
      <Button asChild className="mt-7">
        <Link to="/verify">Try another certificate</Link>
      </Button>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

export function NotFound({ hash }: { hash: string }) {
  return (
    <section className="rounded-2xl border bg-card p-8 text-center shadow-soft">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden />
      </span>
      <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        Certificate not found
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-foreground">
        No matching blockchain record
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        No certificate with this hash exists in the CertiProof registry on Polygon Amoy.
      </p>
      <code className="mt-4 inline-block rounded-lg border bg-muted px-3 py-1.5 font-mono text-xs text-foreground">
        {shorten(hash, 14, 8)}
      </code>
      <ul className="mx-auto mt-6 max-w-sm space-y-1.5 text-left text-sm text-muted-foreground">
        <li>The hash may have been entered incorrectly.</li>
        <li>The certificate may never have been registered.</li>
        <li>The certificate may be fraudulent.</li>
      </ul>
      <Button asChild className="mt-7">
        <Link to="/verify">Try another certificate</Link>
      </Button>
    </section>
  );
}
