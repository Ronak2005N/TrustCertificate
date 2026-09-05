import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function QRCode2D({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#1b2337", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div
      className={cn("overflow-hidden rounded-lg border bg-white", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="Certificate verification QR code" width={size} height={size} />
      ) : (
        <div className="size-full animate-pulse bg-muted" />
      )}
    </div>
  );
}

export function QRCodeCard({
  value,
  caption = "Scan to verify this certificate",
  className,
}: {
  value: string;
  caption?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center shadow-soft",
        className,
      )}
    >
      <QRCode2D value={value} size={148} />
      <p className="text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
