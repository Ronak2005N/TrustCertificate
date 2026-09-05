import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Ban, CheckCircle2, FileStack, PlusCircle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard, ChartCard } from "@/components/common/MetricCard";
import { NetworkStatus } from "@/components/common/NetworkStatus";
import { CertificateTable } from "@/components/dashboard/CertificateTable";
import { RevokeDialog } from "@/components/dashboard/RevokeDialog";
import { Button } from "@/components/ui/button";
import { ORGANIZATION } from "@/lib/demo-data";
import { syncCertificatesFromChain, listCertificates } from "@/lib/certificates";
import type { Certificate } from "@/lib/types";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Issuer Dashboard — Certiproof" },
      {
        name: "description",
        content:
          "Certificate issuance overview, verification activity and recent blockchain-anchored certificates.",
      },
      { property: "og:title", content: "Issuer Dashboard — Certiproof" },
      { property: "og:description", content: "Certificate activity for your institution." },
    ],
  }),
  component: DashboardOverview,
});

function DashboardOverview() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [target, setTarget] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    syncCertificatesFromChain()
      .then((certs) => {
        if (!cancelled) {
          setCertificates(certs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const metrics = {
    total: certificates.length,
    active: certificates.filter((c) => c.status === "active").length,
    revoked: certificates.filter((c) => c.status === "revoked").length,
    verified: certificates.filter((c) => c.chain.transactionHash).length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Good morning"
        title={ORGANIZATION.name}
        description="Certificate activity, verification traffic and on-chain status for your institution."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/issue/bulk">Bulk Issue</Link>
            </Button>
            <Button asChild>
              <Link to="/issue">
                <PlusCircle className="size-4" /> Issue Certificate
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Certificates" value={loading ? "—" : metrics.total} icon={FileStack} />
        <MetricCard
          label="Verified"
          value={loading ? "—" : metrics.verified}
          icon={ShieldCheck}
          tone="success"
          hint="Certificates with on-chain transaction records"
        />
        <MetricCard label="Active" value={loading ? "—" : metrics.active} icon={CheckCircle2} tone="success" />
        <MetricCard label="Revoked" value={loading ? "—" : metrics.revoked} icon={Ban} tone="danger" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent certificates</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/certificates">View all</Link>
          </Button>
        </div>
        {loading ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Loading certificates from blockchain...
          </div>
        ) : certificates.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No certificates found on-chain. Issue your first certificate to get started.
          </div>
        ) : (
          <CertificateTable certificates={certificates.slice(0, 5)} onRevoke={setTarget} />
        )}
      </section>

      <RevokeDialog
        certificate={target}
        open={Boolean(target)}
        onOpenChange={(v) => !v && setTarget(null)}
        onRevoked={(updated) =>
          setCertificates((prev) => prev.map((c) => (c.id === updated.id ? { ...updated } : c)))
        }
      />
    </div>
  );
}
