import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Copy, ExternalLink, FileQuestion, ImageDown, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { PublicNav } from "@/components/layout/PublicNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";
import { BlockchainProof } from "@/components/common/BlockchainProof";
import { HashDisplay } from "@/components/common/HashDisplay";
import { StatusBadge } from "@/components/common/StatusBadge";
import { VerificationTimeline } from "@/components/common/VerificationTimeline";
import { EmptyState } from "@/components/common/EmptyState";
import { downloadCertificateImage } from "@/lib/image-export";
import {
  explorerTx,
  findCertificateById,
  fetchCertificateFromSupabase,
  formatDate,
  formatDateTime,
} from "@/lib/certificates";
import type { Certificate } from "@/lib/types";

export const Route = createFileRoute("/certificate/$id")({
  head: () => ({
    meta: [
      { title: "Certificate detail — Certiproof" },
      {
        name: "description",
        content:
          "View a Certiproof certificate, its blockchain proof, issuance timeline and verification status.",
      },
      { property: "og:title", content: "Certificate detail — Certiproof" },
      {
        property: "og:description",
        content: "Certificate record with on-chain proof and verification status.",
      },
    ],
  }),
  component: CertificateDetail,
  notFoundComponent: CertificateMissing,
  loader: async ({ params }) => {
    if (findCertificateById(params.id)) return null;
    // Not in the session store (direct link / fresh load) — confirm the
    // certificate exists in Supabase before rendering; the component
    // performs the actual fetch on mount.
    let remote: Certificate | null = null;
    try {
      remote = await fetchCertificateFromSupabase(params.id);
    } catch {
      remote = null;
    }
    if (!remote) throw notFound();
    return null;
  },
});

function CertificateMissing() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-20 sm:px-6">
        <EmptyState
          icon={FileQuestion}
          title="Certificate not found"
          description="No certificate exists with that identifier in the registry."
          action={
            <Button asChild>
              <Link to="/verify">Verify a certificate</Link>
            </Button>
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}

function CertificateDetail() {
  const { id } = Route.useParams();
  const [cert, setCert] = useState<Certificate | undefined>(() => findCertificateById(id));
  const [loading, setLoading] = useState(!cert);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!cert) {
      let cancelled = false;
      fetchCertificateFromSupabase(id).then((c) => {
        if (!cancelled) {
          if (c) {
            setCert(c);
          }
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });
      return () => { cancelled = true; };
    }
    return undefined;
  }, [id, cert]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-20 sm:px-6">
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Loading certificate from blockchain...
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!cert) return <CertificateMissing />;

  const revoked = cert.status === "revoked";

  async function downloadImage() {
    if (downloading || !cert || !previewRef.current) return;
    setDownloading(true);
    try {
      await downloadCertificateImage(previewRef.current, cert.id);
      toast.success("Certificate downloaded as PNG");
    } catch {
      toast.error("Could not generate the certificate image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const events = [
    { label: "Certificate issued", timestamp: formatDateTime(cert.chain.confirmedAt) },
    { label: "Blockchain confirmed", timestamp: `Block #${cert.chain.block.toLocaleString("en-US")}` },
    { label: "PDF generated", timestamp: formatDate(cert.issueDate) },
    ...(revoked && cert.chain.revokedAt
      ? [
          {
            label: "Certificate revoked",
            timestamp: formatDateTime(cert.chain.revokedAt),
            tone: "danger" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <CertificatePreview
              ref={previewRef}
              revoked={revoked}
              data={{
                organization: cert.organization,
                type: cert.type,
                recipientName: cert.recipientName,
                course: cert.course,
                description: cert.description,
                issueDate: cert.issueDate,
                id: cert.id,
                hash: cert.hash,
              }}
            />

            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <h2 className="text-sm font-semibold text-foreground">Blockchain timeline</h2>
              <div className="mt-5">
                <VerificationTimeline events={events} />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Verification</h2>
                <StatusBadge status={revoked ? "Revoked" : "Verified"} />
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Certificate ID" value={cert.id} mono />
                <Row label="Recipient" value={cert.recipientName || "Not available"} />
                <Row label="Course" value={cert.course || "Not available"} />
                <Row label="Issue date" value={formatDate(cert.issueDate)} />
                <Row label="Issuer" value={cert.organization} />
              </dl>
              <HashDisplay className="mt-4" label="Certificate hash" value={cert.hash} />
            </section>

            <BlockchainProof record={cert.chain} variant={revoked ? "revoke" : "issue"} />

            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <h2 className="text-sm font-semibold text-foreground">Actions</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => void downloadImage()}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImageDown className="size-4" />
                  )}
                  {downloading ? "Preparing image…" : "Download image"}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(cert.hash);
                    toast.success("Certificate hash copied");
                  }}
                >
                  <Copy className="size-4" /> Copy hash
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(cert.chain.transactionHash);
                    toast.success("Transaction hash copied");
                  }}
                >
                  <Copy className="size-4" /> Copy tx hash
                </Button>
                {cert.chain.transactionHash && (
                  <Button asChild variant="outline">
                    <a
                      href={explorerTx(cert.chain.transactionHash)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink className="size-4" /> View on PolygonScan
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/verify/${cert.hash}`,
                    );
                    toast.success("Verification link copied");
                  }}
                >
                  <Share2 className="size-4" /> Share
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? "text-right font-mono text-xs text-foreground" : "text-right text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
