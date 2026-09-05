import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PublicNav } from "@/components/layout/PublicNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerificationLoader } from "@/components/verify/VerificationLoader";
import { VerificationResultView } from "@/components/verify/VerificationResult";
import { NetworkStatus } from "@/components/common/NetworkStatus";
import { verifyCertificate } from "@/lib/certificates";
import type { VerificationResult } from "@/lib/types";

export const Route = createFileRoute("/verify_/$hash")({
  head: () => ({
    meta: [
      { title: "Certificate verification result — Certiproof" },
      {
        name: "description",
        content:
          "Blockchain verification result for a Certiproof certificate hash, including issuer record and revocation status.",
      },
      { property: "og:title", content: "Certificate verification result — Certiproof" },
      {
        property: "og:description",
        content: "Independent cryptographic proof of certificate authenticity.",
      },
    ],
  }),
  component: VerifyResultPage,
});

function VerifyResultPage() {
  const { hash } = Route.useParams();
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setStage(0);
    void verifyCertificate(hash, (i) => {
      if (!cancelled) setStage(i);
    }).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [hash]);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/verify"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Verify another certificate
            </Link>
            <NetworkStatus />
          </div>

          {result ? (
            <VerificationResultView result={result} />
          ) : (
            <VerificationLoader stage={stage} hash={hash} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
