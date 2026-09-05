import { cn } from "@/lib/utils";
import { NETWORK } from "@/lib/demo-data";

export function NetworkStatus({
  connected = true,
  detailed = false,
  className,
}: {
  connected?: boolean;
  detailed?: boolean;
  className?: string;
}) {
  const dot = connected ? "bg-success" : "bg-destructive";

  if (!detailed) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
        {NETWORK.name}
        <span className="text-foreground">{connected ? "Connected" : "Disconnected"}</span>
      </span>
    );
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-soft", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Network status</h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      <dl className="mt-4 space-y-2.5 text-sm">
        {[
          ["Network", NETWORK.name],
          ["Chain ID", String(NETWORK.chainId)],
          ["Contract", NETWORK.contract],
          ["RPC", connected ? "Connected" : "Unreachable"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate font-mono text-xs text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
