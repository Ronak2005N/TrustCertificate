import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-navy text-navy-foreground">
        <ShieldCheck className="size-[18px]" aria-hidden />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">Certiproof</span>
      )}
    </span>
  );
}
