import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marks mock chain data so nothing reads as a real on-chain transaction. */
export function PrototypeNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-warning",
        className,
      )}
    >
      <FlaskConical className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        Prototype mode — blockchain records shown here are demo data, not real Polygon Amoy
        transactions.
      </span>
    </div>
  );
}
