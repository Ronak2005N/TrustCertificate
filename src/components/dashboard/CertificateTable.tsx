import { Link } from "@tanstack/react-router";
import { Ban, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, shorten } from "@/lib/certificates";
import type { Certificate } from "@/lib/types";

export function CertificateTable({
  certificates,
  onRevoke,
}: {
  certificates: Certificate[];
  onRevoke: (cert: Certificate) => void;
}) {
  async function copyHash(hash: string) {
    await navigator.clipboard.writeText(hash);
    toast.success("Certificate hash copied");
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-soft md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">Recipient</th>
              <th scope="col" className="px-4 py-3 font-medium">Certificate</th>
              <th scope="col" className="px-4 py-3 font-medium">Issued</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Blockchain</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certificates.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{c.recipientName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{c.id}</p>
                </td>
                <td className="max-w-[240px] px-4 py-3">
                  <p className="truncate text-foreground">{c.course}</p>
                  <p className="text-xs text-muted-foreground">{c.type}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatDate(c.issueDate)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3">
                  <code className="font-mono text-xs text-muted-foreground">
                    {shorten(c.chain.transactionHash, 8, 6)}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" aria-label={`View ${c.id}`}>
                      <Link to="/certificate/$id" params={{ id: c.id }}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Copy hash for ${c.id}`}
                      onClick={() => void copyHash(c.hash)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Revoke ${c.id}`}
                      disabled={c.status === "revoked"}
                      onClick={() => onRevoke(c)}
                    >
                      <Ban className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {certificates.map((c) => (
          <li key={c.id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.recipientName}</p>
                <p className="truncate text-xs text-muted-foreground">{c.course}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{c.id}</span>
              <span>{formatDate(c.issueDate)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/certificate/$id" params={{ id: c.id }}>
                  View
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyHash(c.hash)}>
                <Copy className="size-4" /> Hash
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={c.status === "revoked"}
                onClick={() => onRevoke(c)}
              >
                Revoke
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
