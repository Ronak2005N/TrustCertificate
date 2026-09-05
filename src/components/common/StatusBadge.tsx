import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-success-muted text-success border-success/25",
  warning: "bg-warning-muted text-warning border-warning/25",
  danger: "bg-destructive-muted text-destructive border-destructive/25",
  info: "bg-accent text-accent-foreground border-primary/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const LABEL_TONES: Record<string, Tone> = {
  verified: "success",
  active: "success",
  confirmed: "success",
  connected: "success",
  issued: "success",
  match: "success",
  pass: "success",
  pending: "warning",
  processing: "warning",
  waiting: "warning",
  revoked: "danger",
  invalid: "danger",
  failed: "danger",
  mismatch: "danger",
  disconnected: "danger",
  "not found": "danger",
};

export function StatusBadge({
  status,
  tone,
  dot = true,
  className,
}: {
  status: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const resolved = tone ?? LABEL_TONES[status.toLowerCase()] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        TONES[resolved],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {status}
    </span>
  );
}
