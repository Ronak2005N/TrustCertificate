import { useState } from "react";
import { AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProgressSteps } from "@/components/common/ProgressSteps";
import { HashDisplay } from "@/components/common/HashDisplay";
import { REVOKE_STAGES, formatDate, revokeCertificate } from "@/lib/certificates";
import type { Certificate } from "@/lib/types";

export function RevokeDialog({
  certificate,
  open,
  onOpenChange,
  onRevoked,
}: {
  certificate: Certificate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoked?: (cert: Certificate) => void;
}) {
  const [stage, setStage] = useState(-1);

  async function confirm() {
    if (!certificate) return;
    setStage(0);
    try {
      const updated = await revokeCertificate(certificate.id, setStage);
      setStage(REVOKE_STAGES.length);
      toast.success("Certificate revoked successfully");
      onRevoked?.(updated);
    } catch (err) {
      console.error("Revoke error:", err);
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Revocation failed — transaction may have been rejected";
      toast.error(message);
      setStage(-1);
    }
    setTimeout(() => {
      onOpenChange(false);
      setStage(-1);
    }, 900);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (stage >= 0 && stage < REVOKE_STAGES.length) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-destructive-muted text-destructive">
            <AlertOctagon className="size-5" aria-hidden />
          </span>
          <DialogTitle>Revoke certificate?</DialogTitle>
          <DialogDescription>
            This action records the certificate as revoked on the blockchain and cannot be silently
            undone.
          </DialogDescription>
        </DialogHeader>

        {certificate && stage < 0 && (
          <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Recipient</span>
              <span className="text-foreground">{certificate.recipientName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Issue date</span>
              <span className="text-foreground">{formatDate(certificate.issueDate)}</span>
            </div>
            <HashDisplay label="Certificate hash" value={certificate.hash} expandable={false} />
          </div>
        )}

        {stage >= 0 && (
          <div className="rounded-xl border bg-muted/40 p-4">
            <ProgressSteps steps={REVOKE_STAGES} current={stage} />
          </div>
        )}

        {stage < 0 && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirm()}>
              Revoke Certificate
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
