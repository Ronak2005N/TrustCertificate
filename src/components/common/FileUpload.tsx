import { useRef, useState, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileUpload({
  accept,
  hint,
  label,
  icon,
  onFile,
  className,
}: {
  accept: string;
  hint: string;
  label: string;
  icon?: ReactNode;
  onFile: (file: File) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "rounded-2xl border border-dashed bg-card/70 p-6 text-center transition-colors",
        dragging ? "border-primary bg-accent" : "border-border",
        className,
      )}
    >
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon ?? <UploadCloud className="size-5" aria-hidden />}
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
