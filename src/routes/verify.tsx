import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileSearch, QrCode, Upload } from "lucide-react";
import { toast } from "sonner";
import { PublicNav } from "@/components/layout/PublicNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/common/FileUpload";
import { ErrorState } from "@/components/common/ErrorState";
import { ProgressSteps } from "@/components/common/ProgressSteps";
import { NetworkStatus } from "@/components/common/NetworkStatus";
import { ForensicComparison } from "@/components/verify/ForensicComparison";
import { FORENSIC_STAGES, analyzeDocument, isHashLike } from "@/lib/certificates";
import type { ForensicResult } from "@/lib/types";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a Certificate — Certiproof" },
      {
        name: "description",
        content:
          "Check certificate authenticity using its certificate hash, QR code or the certificate document itself.",
      },
      { property: "og:title", content: "Verify a Certificate — Certiproof" },
      {
        property: "og:description",
        content: "Independent blockchain verification of academic certificates.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const [hash, setHash] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [forensicStage, setForensicStage] = useState(-1);
  const [forensic, setForensic] = useState<ForensicResult | null>(null);
  const [fileName, setFileName] = useState("");

  function submitHash(e: React.FormEvent) {
    e.preventDefault();
    const value = hash.trim();
    if (!value) {
      setError("Please enter a certificate hash.");
      return;
    }
    if (!value.startsWith("0x")) {
      setError("Certificate hash must start with 0x.");
      return;
    }
    if (!isHashLike(value)) {
      setError(
        "Invalid certificate hash. Expected a 0x-prefixed 64-character hexadecimal SHA-256 hash (66 characters total).",
      );
      return;
    }
    setError(null);
    void navigate({ to: "/verify/$hash", params: { hash: value } });
  }

  async function runForensic(file: File) {
    setFileName(file.name);
    setForensic(null);
    setForensicStage(0);
    try {
      const result = await analyzeDocument(file, setForensicStage);
      setForensicStage(FORENSIC_STAGES.length);
      setForensic(result);
    } catch {
      setForensicStage(-1);
      toast.error("Upload failed. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
              Verify a Certificate
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Check authenticity using its certificate hash or upload the certificate document.
            </p>
            <div className="mt-5 flex justify-center">
              <NetworkStatus />
            </div>
          </div>

          {/* Method A — certificate hash */}
          <section className="glass-panel mt-10 rounded-2xl p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Method A</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Certificate hash</h2>
            <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={submitHash}>
              <div className="flex-1">
                <Label htmlFor="hash" className="sr-only">
                  Certificate hash
                </Label>
                <Input
                  id="hash"
                  value={hash}
                  onChange={(e) => {
                    setHash(e.target.value);
                    setError(null);
                  }}
                  placeholder="0x..."
                  className="h-11 font-mono"
                  aria-describedby="hash-help"
                />
              </div>
              <Button type="submit" size="lg" className="sm:w-auto">
                Verify Certificate
              </Button>
            </form>
            <p id="hash-help" className="mt-3 text-xs text-muted-foreground">
              Enter the SHA-256 certificate hash from the issued certificate to verify it on the
              Polygon Amoy blockchain.
            </p>
            {error && (
              <ErrorState
                className="mt-5"
                title="Invalid hash"
                description={error}
                hint="A certificate hash is a 0x-prefixed 64-character hexadecimal SHA-256 fingerprint."
              />
            )}
          </section>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Method B — QR */}
            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                Method B
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Scan QR code</h2>
              <div className="relative mt-5 flex h-44 items-center justify-center rounded-xl border border-dashed bg-muted/50">
                <QrCode className="size-16 text-muted-foreground/40" aria-hidden />
                <span
                  className="absolute inset-x-8 top-1/2 h-px animate-pulse bg-primary/60"
                  aria-hidden
                />
                <span
                  className="absolute top-3 left-3 size-5 rounded-tl border-t-2 border-l-2 border-primary/50"
                  aria-hidden
                />
                <span
                  className="absolute top-3 right-3 size-5 rounded-tr border-t-2 border-r-2 border-primary/50"
                  aria-hidden
                />
                <span
                  className="absolute bottom-3 left-3 size-5 rounded-bl border-b-2 border-l-2 border-primary/50"
                  aria-hidden
                />
                <span
                  className="absolute right-3 bottom-3 size-5 rounded-br border-b-2 border-r-2 border-primary/50"
                  aria-hidden
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Point a phone camera at the certificate QR code to scan the certificate hash.
              </p>
            </section>

            {/* Method C — document */}
            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                Method C
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Upload certificate</h2>
              <FileUpload
                className="mt-5"
                accept=".pdf,.jpg,.jpeg,.png"
                label="Drop the certificate here"
                hint="Supported: PDF / JPG / PNG"
                icon={<FileSearch className="size-5" aria-hidden />}
                onFile={(f) => void runForensic(f)}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Upload the certificate document. Its cryptographic hash will be compared against the
                on-chain registry.
              </p>
            </section>
          </div>

          {forensicStage >= 0 && (
            <section id="forensic" className="mt-8 scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground">Document authenticity check</h2>
              <p className="mt-1 text-sm text-muted-foreground">{fileName}</p>
              {!forensic ? (
                <div className="glass-panel mt-5 rounded-2xl p-6">
                  <ProgressSteps steps={FORENSIC_STAGES} current={forensicStage} />
                </div>
              ) : (
                <ForensicComparison result={forensic} className="mt-5" />
              )}
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
