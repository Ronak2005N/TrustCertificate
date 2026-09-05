import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileStack, PlusCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { CertificateTable } from "@/components/dashboard/CertificateTable";
import { RevokeDialog } from "@/components/dashboard/RevokeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { syncCertificatesFromChain } from "@/lib/certificates";
import type { Certificate, CertificateStatus } from "@/lib/types";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({
    meta: [
      { title: "Certificate management — Certiproof" },
      {
        name: "description",
        content:
          "Search, filter and manage every certificate your institution has anchored on the blockchain.",
      },
      { property: "og:title", content: "Certificate management — Certiproof" },
      { property: "og:description", content: "Manage issued and revoked certificates." },
    ],
  }),
  component: CertificatesPage,
});

type Filter = "all" | CertificateStatus;

function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [target, setTarget] = useState<Certificate | null>(null);

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = certificates.filter((c) => {
      const matchesQuery =
        !q ||
        [c.recipientName, c.course, c.id, c.hash].some((v) => v.toLowerCase().includes(q));
      const matchesFilter = filter === "all" || c.status === filter;
      return matchesQuery && matchesFilter;
    });
    return rows.sort((a, b) => {
      if (sort === "name") return a.recipientName.localeCompare(b.recipientName);
      const diff = new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
      return sort === "newest" ? diff : -diff;
    });
  }, [certificates, query, filter, sort]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Certificates"
        description="Every certificate issued by your institution, with its on-chain record."
        actions={
          <Button asChild>
            <Link to="/issue">
              <PlusCircle className="size-4" /> Issue Certificate
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading certificates from blockchain...
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search certificate, recipient or hash"
                className="pl-9"
                aria-label="Search certificates"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="sm:w-36" aria-label="Sort certificates">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name">Recipient A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={FileStack}
              title="No certificates match"
              description="Try a different search term or clear the status filter."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <CertificateTable certificates={visible} onRevoke={setTarget} />
          )}
        </>
      )}

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
