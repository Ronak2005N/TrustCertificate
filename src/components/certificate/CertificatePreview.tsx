import { ShieldCheck } from "lucide-react";
import { QRCode2D } from "@/components/common/QRCodeCard";
import { formatDate, shorten } from "@/lib/certificates";
import { ORGANIZATION } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export interface CertificatePreviewData {
  organization?: string;
  type?: string;
  recipientName?: string;
  course?: string;
  issueDate?: string;
  id?: string;
  hash?: string;
}

export function CertificatePreview({
  data,
  revoked = false,
  className,
}: {
  data: CertificatePreviewData;
  revoked?: boolean;
  className?: string;
}) {
  const organization = data.organization || ORGANIZATION.name;
  const recipient = data.recipientName || "Recipient name";
  const course = data.course || "Programme / course title";
  const type = data.type || "Certificate";
  const date = data.issueDate ? formatDate(data.issueDate) : "—";
  const id = data.id || "CERT-XXXX-XXXXXX";
  const hash = data.hash || "0x…";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-6 shadow-soft sm:p-8",
        className,
      )}
      aria-label="Certificate preview"
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden />

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-navy text-navy-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{organization}</p>
            <p className="text-xs text-muted-foreground">Verified issuing institution</p>
          </div>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          {type}
        </span>
      </header>

      <div className="mt-8 text-center">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          This is to certify that
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">{recipient}</h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          has successfully completed the requirements for
        </p>
        <p className="mx-auto mt-2 max-w-lg text-base font-medium text-foreground">{course}</p>
      </div>

      <div className="mt-8 flex flex-col gap-6 border-t pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="font-[cursive] text-lg text-foreground">{ORGANIZATION.signatory}</p>
          <div className="h-px w-40 bg-border" />
          <p className="text-xs text-muted-foreground">{ORGANIZATION.signatoryTitle}</p>
          <p className="pt-2 text-xs text-muted-foreground">
            Issued <span className="text-foreground">{date}</span>
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">{id}</p>
        </div>

        <div className="flex items-end gap-4">
          <div className="text-right">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Certificate hash
            </p>
            <code className="font-mono text-[11px] text-foreground">{shorten(hash, 10, 6)}</code>
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                revoked
                  ? "border-destructive/30 bg-destructive-muted text-destructive"
                  : "border-success/30 bg-success-muted text-success",
              )}
            >
              {revoked ? "Revoked" : "Blockchain verified"}
            </p>
          </div>
          <QRCode2D value={`https://certiproof.app/verify/${hash}`} size={82} />
        </div>
      </div>
    </article>
  );
}
