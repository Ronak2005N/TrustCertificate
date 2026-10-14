import { useRef, useState, type RefObject } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImageDown,
  Loader2,
  Share2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/common/PageHeader";
import { ProgressSteps } from "@/components/common/ProgressSteps";
import { HashDisplay } from "@/components/common/HashDisplay";
import { BlockchainProof } from "@/components/common/BlockchainProof";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ISSUANCE_STAGES,
  issueCertificate,
  type IssueInput,
  type IssuanceError,
} from "@/lib/certificates";
import { downloadCertificateImage } from "@/lib/image-export";
import { CERTIFICATE_TYPES, type Certificate, type CertificateType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/issue")({
  head: () => ({
    meta: [
      { title: "Issue a certificate — Certiproof" },
      {
        name: "description",
        content:
          "Create a certificate, anchor its SHA-256 fingerprint on the blockchain and share a verifiable link with the recipient.",
      },
      { property: "og:title", content: "Issue a certificate — Certiproof" },
      { property: "og:description", content: "Issue blockchain-anchored certificates in minutes." },
    ],
  }),
  component: IssuePage,
});

const STEPS = ["Recipient details", "Certificate details", "Review & issue"];

function IssuePage() {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState(-1);
  const [issued, setIssued] = useState<Certificate | null>(null);
  const [issueError, setIssueError] = useState<IssuanceError | null>(null);
  const previewRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<IssueInput>({
    recipientName: "",
    recipientEmail: "",
    course: "",
    type: "Completion",
    issueDate: new Date().toISOString().slice(0, 10),
    description: "",
  });

  const set = <K extends keyof IssueInput>(key: K, value: IssueInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const stepValid =
    step === 0
      ? Boolean(form.recipientName.trim() && /.+@.+\..+/.test(form.recipientEmail))
      : step === 1
        ? Boolean(form.course.trim() && form.issueDate)
        : true;

  async function submit() {
    setStage(0);
    setIssueError(null);
    try {
      const cert = await issueCertificate(form, setStage);
      setStage(ISSUANCE_STAGES.length);
      setIssued(cert);
      toast.success("Certificate issued and anchored on-chain");
    } catch (err) {
      const issuanceErr = err as IssuanceError;
      setIssueError(issuanceErr);
      setStage(-1);
      toast.error(issuanceErr.message);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title={issued ? "Certificate issued" : "Issue certificate"}
          description={
            issued
              ? "The certificate is anchored on-chain and ready to share with the recipient."
              : "Enter recipient and certificate details, then anchor the record on the blockchain."
          }
          actions={
            <Button asChild variant="outline">
              <Link to="/dashboard/certificates">All certificates</Link>
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            {issued ? (
              <IssuedSummary
                certificate={issued}
                certificateRef={previewRef}
                onIssueAnother={() => {
                  setIssued(null);
                  setStage(-1);
                  setStep(0);
                  setForm((f) => ({ ...f, recipientName: "", recipientEmail: "", course: "" }));
                }}
              />
            ) : stage >= 0 ? (
              <div className="space-y-5">
                <h2 className="text-sm font-semibold text-foreground">Anchoring certificate</h2>
                <ProgressSteps steps={ISSUANCE_STAGES} current={stage} />
              </div>
            ) : issueError ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive-muted text-destructive">
                      <AlertCircle className="size-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Certificate issuance failed</p>
                      <p className="text-sm text-muted-foreground">{issueError.message}</p>
                      {issueError.type === "insufficient_funds" && (
                        <p className="text-xs text-muted-foreground">
                          Get test POL from{" "}
                          <a href="https://faucet.polygon.technology" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Polygon Faucet
                          </a>
                        </p>
                      )}
                      {issueError.type === "metamask_missing" && (
                        <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          Install MetaMask →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setIssueError(null)}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <ol className="mb-6 flex items-center gap-2 text-xs">
                  {STEPS.map((label, i) => (
                    <li key={label} className="flex flex-1 items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                          i < step && "border-success bg-success text-success-foreground",
                          i === step && "border-primary text-primary",
                          i > step && "border-border text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={cn(
                          "hidden truncate sm:block",
                          i === step ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                      {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
                    </li>
                  ))}
                </ol>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (step < 2) setStep((s) => s + 1);
                    else void submit();
                  }}
                >
                  {step === 0 && (
                    <>
                      <Field label="Recipient full name" htmlFor="name">
                        <Input
                          id="name"
                          value={form.recipientName}
                          onChange={(e) => set("recipientName", e.target.value)}
                          placeholder="Aarav Krishnan"
                          required
                        />
                      </Field>
                      <Field label="Recipient email" htmlFor="email">
                        <Input
                          id="email"
                          type="email"
                          value={form.recipientEmail}
                          onChange={(e) => set("recipientEmail", e.target.value)}
                          placeholder="aarav.krishnan@example.edu"
                          required
                        />
                      </Field>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Field label="Course / programme" htmlFor="course">
                        <Input
                          id="course"
                          value={form.course}
                          onChange={(e) => set("course", e.target.value)}
                          placeholder="B.Tech Computer Science and Engineering"
                          required
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Certificate type" htmlFor="type">
                          <Select
                            value={form.type}
                            onValueChange={(v) => set("type", v as CertificateType)}
                          >
                            <SelectTrigger id="type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CERTIFICATE_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Issue date" htmlFor="date">
                          <Input
                            id="date"
                            type="date"
                            value={form.issueDate}
                            onChange={(e) => set("issueDate", e.target.value)}
                            required
                          />
                        </Field>
                      </div>
                      <Field label="Description (optional)" htmlFor="description">
                        <Textarea
                          id="description"
                          rows={3}
                          value={form.description}
                          onChange={(e) => set("description", e.target.value)}
                          placeholder="Awarded on completion of the four-year programme."
                        />
                      </Field>
                    </>
                  )}

                  {step === 2 && (
                    <dl className="divide-y rounded-xl border bg-muted/30 text-sm">
                      {[
                        ["Recipient", form.recipientName],
                        ["Email", form.recipientEmail],
                        ["Course", form.course],
                        ["Type", form.type],
                        ["Issue date", form.issueDate],
                        ["Description", form.description || "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-6 px-4 py-3">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="text-right text-foreground">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <div className="flex justify-between pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={step === 0}
                      onClick={() => setStep((s) => s - 1)}
                    >
                      <ArrowLeft className="size-4" /> Back
                    </Button>
                    <Button type="submit" disabled={!stepValid}>
                      {step < 2 ? (
                        <>
                          Continue <ArrowRight className="size-4" />
                        </>
                      ) : (
                        "Issue Certificate"
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Live preview
            </p>
            <CertificatePreview
              ref={previewRef}
              data={{
                recipientName: form.recipientName,
                course: form.course,
                type: form.type,
                issueDate: form.issueDate,
                description: form.description,
                ...(issued ? { id: issued.id, hash: issued.hash } : {}),
              }}
            />
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function IssuedSummary({
  certificate,
  certificateRef,
  onIssueAnother,
}: {
  certificate: Certificate;
  certificateRef: RefObject<HTMLElement | null>;
  onIssueAnother: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  async function downloadImage() {
    if (downloading || !certificateRef.current) return;
    setDownloading(true);
    try {
      await downloadCertificateImage(certificateRef.current, certificate.id);
      toast.success("Certificate downloaded as PNG");
    } catch {
      toast.error("Could not generate the certificate image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-success-muted text-success">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Certificate anchored on-chain</h2>
          <p className="text-sm text-muted-foreground">{certificate.id}</p>
        </div>
      </div>

      <HashDisplay label="Certificate hash" value={certificate.hash} />
      <BlockchainProof record={certificate.chain} />

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/certificate/$id" params={{ id: certificate.id }}>
            View certificate
          </Link>
        </Button>
        <Button variant="outline" onClick={() => void downloadImage()} disabled={downloading}>
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageDown className="size-4" />
          )}
          {downloading ? "Preparing image…" : "Download Certificate as Image"}
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.info("Prototype: email to recipient is simulated")}
        >
          <Share2 className="size-4" /> Email recipient
        </Button>
        <Button variant="ghost" onClick={onIssueAnother}>
          Issue another
        </Button>
      </div>
    </div>
  );
}
