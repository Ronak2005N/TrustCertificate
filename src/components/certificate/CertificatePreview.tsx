import { useEffect, useRef, useState, type Ref } from "react";
import { ShieldCheck } from "lucide-react";
import { QRCode2D } from "@/components/common/QRCodeCard";
import { formatDate, shorten } from "@/lib/certificates";
import { ORGANIZATION } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export interface CertificatePreviewData {
  organization?: string;
  type?: string;
  recipientName?: string;
  course?: string;
  description?: string | undefined;
  issueDate?: string;
  id?: string;
  hash?: string;
}

/**
 * Natural (unscaled) certificate size. 1414 x 1000 is exactly 1.414:1
 * (A4 landscape proportions). The on-screen preview scales this document to
 * fit its container; the image export always renders it at this size so the
 * exported PNG matches the preview and never changes dimensions.
 */
const CERT_WIDTH = 1414;
const CERT_HEIGHT = 1000;

const NAVY = "#1A365D";
const INK = "#141d38";
const GOLD = "#b9974c";
const SLATE = "#5d6b85";
const FAINT = "#8b93a7";

const TITLE_BY_TYPE: Record<string, string> = {
  Completion: "Certificate of Completion",
  Excellence: "Certificate of Excellence",
  Participation: "Certificate of Participation",
};

const CORNER_TICKS = [
  "left-[26px] top-[26px] border-l-2 border-t-2",
  "right-[26px] top-[26px] border-r-2 border-t-2",
  "left-[26px] bottom-[26px] border-l-2 border-b-2",
  "right-[26px] bottom-[26px] border-r-2 border-b-2",
];

export function CertificatePreview({
  data,
  revoked = false,
  className,
  ref,
}: {
  data: CertificatePreviewData;
  revoked?: boolean;
  className?: string;
  ref?: Ref<HTMLElement>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / CERT_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const organization = data.organization || ORGANIZATION.name;
  const recipient = data.recipientName || "Recipient name";
  const course = data.course || "Programme / course title";
  const type = data.type || "Certificate";
  const description = data.description?.trim();
  const date = data.issueDate ? formatDate(data.issueDate) : "—";
  const id = data.id || "CERT-XXXX-XXXXXX";
  const hash = data.hash || "0x…";
  const title = TITLE_BY_TYPE[type] || "Certificate of Achievement";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-black/[0.07]",
        className,
      )}
      style={{ aspectRatio: "297 / 210" }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: CERT_WIDTH, height: CERT_HEIGHT, transform: `scale(${scale})` }}
      >
        <article
          ref={ref}
          aria-label="Certificate preview"
          className="relative flex flex-col overflow-hidden font-sans text-[#141d38]"
          style={{ width: CERT_WIDTH, height: CERT_HEIGHT, backgroundColor: "#ffffff" }}
        >
          {/* Double frame: navy rule + gold hairline */}
          <div
            className="pointer-events-none absolute border-[3px] border-[#1A365D]"
            style={{ inset: "16px" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute border border-[#b9974c]/75"
            style={{ inset: "26px" }}
            aria-hidden
          />
          {CORNER_TICKS.map((position) => (
            <span
              key={position}
              className={cn("pointer-events-none absolute size-7 border-[#b9974c]", position)}
              aria-hidden
            />
          ))}

          <div className="relative flex h-full flex-col" style={{ padding: "58px 100px 46px" }}>
            {/* ---- Top: institution identity ---- */}
            <header className="flex flex-col items-center text-center">
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: 60, height: 60, backgroundColor: NAVY, color: "#ffffff" }}
              >
                <ShieldCheck className="size-7" aria-hidden />
              </span>
              <p
                className="mt-3.5 font-semibold uppercase"
                style={{ fontSize: 26, letterSpacing: "0.16em", color: NAVY }}
              >
                {organization}
              </p>
              <p
                className="mt-1.5"
                style={{ fontSize: 13.5, letterSpacing: "0.08em", color: SLATE }}
              >
                {ORGANIZATION.shortName} · {ORGANIZATION.domain}
              </p>
              <span className="mt-4 flex items-center gap-3" aria-hidden>
                <span className="h-px w-24" style={{ backgroundColor: GOLD }} />
                <span className="size-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
                <span className="h-px w-24" style={{ backgroundColor: GOLD }} />
              </span>
            </header>

            {/* ---- Main: certification statement ---- */}
            <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden pt-5 pb-4 text-center">
              <p
                className="font-medium uppercase"
                style={{ fontSize: 12.5, letterSpacing: "0.42em", color: "#a4823c" }}
              >
                {type}
              </p>
              <h2
                className="mt-3 font-semibold uppercase"
                style={{ fontSize: 46, letterSpacing: "0.1em", color: NAVY }}
              >
                {title}
              </h2>
              <p
                className="mt-6 uppercase"
                style={{ fontSize: 14, letterSpacing: "0.3em", color: SLATE }}
              >
                This is to certify that
              </p>
              <h3
                className="mt-3.5 max-w-[1150px] text-balance break-words font-semibold"
                style={{ fontSize: 64, lineHeight: 1.08, color: INK }}
              >
                {recipient}
              </h3>
              <span
                className="mt-5 h-0.5 w-[150px]"
                style={{ backgroundColor: GOLD }}
                aria-hidden
              />
              <p className="mt-5" style={{ fontSize: 15.5, color: SLATE }}>
                has successfully completed the requirements for
              </p>
              <p
                className="mt-3 max-w-[950px] text-balance font-medium"
                style={{ fontSize: 27, lineHeight: 1.3, color: NAVY }}
              >
                {course}
              </p>
              {description && (
                <p
                  className="mt-3.5 max-w-[860px] italic"
                  style={{ fontSize: 14.5, lineHeight: 1.45, color: "#6d7791" }}
                >
                  {description}
                </p>
              )}
            </main>

            {/* ---- Bottom: signatures, meta, QR ---- */}
            <footer className="flex items-end justify-between gap-6">
              <div className="flex w-[360px] flex-col items-center text-center">
                <p className="font-serif italic" style={{ fontSize: 27, color: INK }}>
                  {ORGANIZATION.signatory}
                </p>
                <span
                  className="mt-1.5 h-px w-[300px]"
                  style={{ backgroundColor: "rgba(20, 29, 56, 0.45)" }}
                  aria-hidden
                />
                <p
                  className="mt-1.5 uppercase"
                  style={{ fontSize: 12.5, letterSpacing: "0.18em", color: SLATE }}
                >
                  {ORGANIZATION.signatoryTitle}
                </p>
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 pb-1 text-center">
                <div className="flex items-start gap-12">
                  <div>
                    <p
                      className="uppercase"
                      style={{ fontSize: 10.5, letterSpacing: "0.22em", color: FAINT }}
                    >
                      Date of issue
                    </p>
                    <p className="mt-1 font-semibold" style={{ fontSize: 16.5, color: INK }}>
                      {date}
                    </p>
                  </div>
                  <div>
                    <p
                      className="uppercase"
                      style={{ fontSize: 10.5, letterSpacing: "0.22em", color: FAINT }}
                    >
                      Certificate ID
                    </p>
                    <p className="mt-1 font-mono" style={{ fontSize: 15, color: INK }}>
                      {id}
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold uppercase",
                  )}
                  style={
                    revoked
                      ? {
                          fontSize: 11,
                          letterSpacing: "0.14em",
                          color: "#b3392f",
                          backgroundColor: "#fbeceb",
                          borderColor: "#f2cbc7",
                        }
                      : {
                          fontSize: 11,
                          letterSpacing: "0.14em",
                          color: "#157f4f",
                          backgroundColor: "#eaf6ef",
                          borderColor: "#bfe3cd",
                        }
                  }
                >
                  <ShieldCheck className="size-3" aria-hidden />
                  {revoked ? "Revoked" : "Blockchain verified"}
                </span>

                <p className="font-mono" style={{ fontSize: 11.5, color: FAINT }}>
                  Certificate hash {shorten(hash, 10, 6)}
                </p>
              </div>

              <div className="flex w-[360px] flex-col items-center gap-2">
                <QRCode2D value={`https://certiproof.app/verify/${hash}`} size={128} />
                <p
                  className="uppercase"
                  style={{ fontSize: 11.5, letterSpacing: "0.2em", color: SLATE }}
                >
                  Scan to verify
                </p>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </div>
  );
}
