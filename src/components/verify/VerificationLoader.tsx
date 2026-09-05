import { ProgressSteps } from "@/components/common/ProgressSteps";
import { VERIFICATION_STAGES, shorten } from "@/lib/certificates";

export function VerificationLoader({ stage, hash }: { stage: number; hash: string }) {
  const done = stage >= VERIFICATION_STAGES.length;
  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-8" aria-live="polite">
      <h2 className="text-base font-semibold text-foreground">
        {done ? "Verification complete" : "Verifying certificate..."}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {done
          ? "Blockchain query finished"
          : "Checking Polygon Amoy blockchain..."}
      </p>
      <code className="mt-2 block font-mono text-xs text-muted-foreground">
        {shorten(hash, 14, 8)}
      </code>
      <ProgressSteps steps={VERIFICATION_STAGES} current={stage} className="mt-6" />
    </section>
  );
}
