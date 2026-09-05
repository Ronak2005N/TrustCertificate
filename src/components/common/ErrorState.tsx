import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ErrorState({
  title,
  description,
  hint,
  action,
  className,
}: {
  title: string;
  description: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-destructive/25 bg-destructive-muted/70 p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}
