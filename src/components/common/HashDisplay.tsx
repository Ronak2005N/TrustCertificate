import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { shorten } from "@/lib/certificates";

export function HashDisplay({
  value,
  label,
  toastMessage = "Certificate hash copied",
  expandable = true,
  className,
}: {
  value: string;
  label?: string;
  toastMessage?: string;
  expandable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(toastMessage);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-1.5 rounded-lg border bg-muted/60 px-2.5 py-1.5">
        <code
          className={cn(
            "min-w-0 flex-1 font-mono text-xs text-foreground",
            expanded ? "break-all" : "truncate",
          )}
        >
          {expanded ? value : shorten(value, 10, 6)}
        </code>
        {expandable && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {expanded ? "Less" : "Full"}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label ?? "value"}`}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
