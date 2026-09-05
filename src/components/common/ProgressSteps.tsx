import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Vertical staged progress used by verification, issuance and revocation flows. */
export function ProgressSteps({
  steps,
  current,
  className,
}: {
  steps: string[];
  /** Index of the active step; >= steps.length means all complete. */
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-3", className)}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                done && "border-success bg-success text-success-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? (
                <Check className="size-3" />
              ) : active ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-40" />
              )}
            </span>
            <span
              className={cn(
                "text-sm transition-colors",
                done && "text-foreground",
                active && "font-medium text-foreground",
                !done && !active && "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal numbered step indicator for multi-step forms. */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-success bg-success text-success-foreground",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && <span className="hidden h-px w-8 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
