import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Rocket } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FileUpload } from "@/components/common/FileUpload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PrototypeNotice } from "@/components/common/PrototypeNotice";
import { SAMPLE_CSV } from "@/lib/demo-data";
import { issueCertificate, parseCsv, wait } from "@/lib/certificates";
import type { BulkRow, CertificateType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/issue_/bulk")({
  head: () => ({
    meta: [
      { title: "Bulk certificate issuance — Certiproof" },
      {
        name: "description",
        content:
          "Upload a CSV to issue an entire batch of certificates, each with its own blockchain-anchored fingerprint.",
      },
      { property: "og:title", content: "Bulk certificate issuance — Certiproof" },
      { property: "og:description", content: "Issue certificates for a whole cohort at once." },
    ],
  }),
  component: BulkIssuePage,
});

function BulkIssuePage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [processed, setProcessed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const valid = rows.filter((r) => r.valid);
  const invalid = rows.length - valid.length;

  function loadCsv(text: string, name: string) {
    const parsed = parseCsv(text);
    setRows(parsed);
    setFileName(name);
    setProcessed(0);
    setDone(false);
    if (parsed.length === 0) toast.error("No rows found in that CSV");
  }

  async function run() {
    setRunning(true);
    for (const [i, row] of valid.entries()) {
      await issueCertificate({
        recipientName: row.name,
        recipientEmail: row.email,
        course: row.course,
        type: row.type as CertificateType,
        issueDate: row.date,
      });
      setProcessed(i + 1);
      await wait(120);
    }
    setRunning(false);
    setDone(true);
    toast.success(`${valid.length} certificates issued on-chain`);
  }

  const percent = valid.length ? Math.round((processed / valid.length) * 100) : 0;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          eyebrow="Batch"
          title="Bulk issuance"
          description="Upload a CSV of recipients. Each row becomes its own certificate with a unique on-chain fingerprint."
          actions={
            <Button asChild variant="outline">
              <Link to="/issue">Single certificate</Link>
            </Button>
          }
        />

        {rows.length === 0 && (
          <div className="space-y-4">
            <FileUpload
              accept=".csv,text/csv"
              label="Upload recipient CSV"
              hint="Columns: name, email, course, date, type"
              icon={<FileSpreadsheet className="size-5" aria-hidden />}
              onFile={(file) => {
                const reader = new FileReader();
                reader.onload = () => loadCsv(String(reader.result ?? ""), file.name);
                reader.readAsText(file);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => loadCsv(SAMPLE_CSV, "sample-cohort.csv")}>
                Use sample CSV
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "certiproof-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="size-4" /> Download template
              </Button>
            </div>
            <PrototypeNotice />
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileSpreadsheet className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {rows.length} rows · {valid.length} valid
                    {invalid > 0 && ` · ${invalid} need attention`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={running}
                  onClick={() => {
                    setRows([]);
                    setFileName(null);
                    setDone(false);
                  }}
                >
                  Replace file
                </Button>
                <Button onClick={() => void run()} disabled={running || done || valid.length === 0}>
                  <Rocket className="size-4" />
                  {running ? "Issuing…" : done ? "Completed" : `Issue ${valid.length} certificates`}
                </Button>
              </div>
            </div>

            {(running || done) && (
              <div className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {done ? "Batch complete" : "Anchoring certificates"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {processed}/{valid.length}
                  </span>
                </div>
                <Progress value={percent} />
                {done && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/dashboard/certificates">View certificates</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info("Prototype: batch PDF export is simulated")}
                    >
                      <Download className="size-4" /> Export batch PDFs
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">#</th>
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-4 py-3 font-medium">Email</th>
                    <th scope="col" className="px-4 py-3 font-medium">Course</th>
                    <th scope="col" className="px-4 py-3 font-medium">Date</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const issuedRow = row.valid && i < processed;
                    return (
                      <tr
                        key={`${row.email}-${i}`}
                        className={cn("border-b last:border-0", !row.valid && "bg-destructive-muted/40")}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 text-foreground">{row.name || "—"}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                          {row.email || "—"}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                          {row.course || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.date || "—"}</td>
                        <td className="px-4 py-3">
                          {!row.valid ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                              <AlertTriangle className="size-3.5" aria-hidden /> {row.issue}
                            </span>
                          ) : issuedRow ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                              <CheckCircle2 className="size-3.5" aria-hidden /> Issued
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
