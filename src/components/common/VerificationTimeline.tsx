import { cn } from "@/lib/utils";

export interface TimelineEvent {
  label: string;
  timestamp: string;
  tone?: "default" | "danger";
}

export function VerificationTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-5 pl-6">
      <span className="absolute top-1.5 bottom-1.5 left-[7px] w-px bg-border" aria-hidden />
      {events.map((event) => (
        <li key={event.label} className="relative">
          <span
            className={cn(
              "absolute top-1 -left-[22px] size-[15px] rounded-full border-2 border-background",
              event.tone === "danger" ? "bg-destructive" : "bg-success",
            )}
            aria-hidden
          />
          <p className="text-sm font-medium text-foreground">{event.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{event.timestamp}</p>
        </li>
      ))}
    </ol>
  );
}
