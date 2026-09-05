import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Binary,
  Building2,
  FileCheck2,
  Layers,
  QrCode,
  ScanLine,
  ServerCrash,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, SectionHeading } from "@/components/common/Reveal";
import { HashDisplay } from "@/components/common/HashDisplay";
import { PrototypeNotice } from "@/components/common/PrototypeNotice";
import { DEMO_HASHES, NETWORK, ORGANIZATION } from "@/lib/demo-data";
import { shorten } from "@/lib/certificates";

export function TrustSignals() {
  const items = [
    { label: "Cryptographic fingerprint", value: "SHA-256" },
    { label: "Public registry", value: NETWORK.contract },
    { label: "Network", value: NETWORK.name },
    { label: "Verification cost", value: "Free & public" },
  ];
  return (
    <section className="border-y bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-4 sm:px-6 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="px-2 py-6 sm:px-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const PROBLEMS = [
  {
    icon: QrCode,
    title: "Spoofable QR Codes",
    body: "Traditional QR systems may simply point to a website. Anyone who can host a page can imitate a verification result.",
  },
  {
    icon: ServerCrash,
    title: "Single Point of Failure",
    body: "Centralized verification systems depend on one server or authority. If it disappears, every certificate becomes unverifiable.",
  },
  {
    icon: ShieldAlert,
    title: "No Cryptographic Proof",
    body: "Visual certificates, seals and watermarks alone are not independent proof. They can be reproduced convincingly.",
  },
];

export function ProblemSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal>
        <SectionHeading
          eyebrow="The problem"
          title="Why current systems fail"
          description="Certificate fraud does not need sophisticated forgery — it only needs a convincing verification page."
        />
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PROBLEMS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <article className="group h-full rounded-2xl border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <p.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const LAYERS = [
  {
    tag: "Layer 01",
    icon: Binary,
    title: "Cryptographic Hash",
    body: "Every certificate receives a unique SHA-256 fingerprint derived from its contents.",
  },
  {
    tag: "Layer 02",
    icon: Layers,
    title: "Blockchain Registry",
    body: "The certificate hash is anchored to the Polygon blockchain through CertChainRegistry.",
  },
  {
    tag: "Layer 03",
    icon: ShieldCheck,
    title: "Independent Verification",
    body: "Anyone can independently confirm the certificate record without trusting our website.",
  },
];

export function ThreeLayers() {
  return (
    <section className="border-y bg-surface/60">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Architecture"
            title="Three layers of trust"
            description="Each layer removes a reason to simply take our word for it."
          />
        </Reveal>

        <div className="relative mt-12">
          <motion.span
            aria-hidden
            className="absolute top-[46px] right-[16%] left-[16%] hidden h-px origin-left bg-primary/40 lg:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />
          <div className="relative grid gap-5 lg:grid-cols-3">
            {LAYERS.map((l, i) => (
              <Reveal key={l.tag} delay={i * 0.18}>
                <article className="h-full rounded-2xl border bg-card p-6 text-center shadow-soft">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-xl border bg-background text-primary">
                    <l.icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-4 font-mono text-xs tracking-widest text-muted-foreground">
                    {l.tag}
                  </p>
                  <h3 className="mt-1.5 text-base font-semibold text-foreground">{l.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  ["Step 01", "Institution creates certificate", "The issuer enters recipient and programme details in the Certiproof dashboard."],
  ["Step 02", "Certificate metadata is hashed", "A SHA-256 fingerprint is computed from the exact certificate contents."],
  ["Step 03", "Hash is recorded on blockchain", "CertChainRegistry stores the hash, issuer wallet and timestamp."],
  ["Step 04", "Certificate PDF and QR code are generated", "The QR encodes the certificate hash, not a marketing page."],
  ["Step 05", "Recipient shares certificate", "The graduate sends the PDF or a verification link to anyone."],
  ["Step 06", "Employer/verifier checks QR or hash", "No account, no login, no request to the issuing institution."],
  ["Step 07", "Blockchain confirms authenticity", "The registry answers: issued, by whom, when, and whether revoked."],
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal>
        <SectionHeading
          eyebrow="Lifecycle"
          title="How Certiproof works"
          description="From issuance to independent verification — seven steps, no blockchain knowledge required."
        />
      </Reveal>

      <ol className="relative mx-auto mt-12 max-w-3xl space-y-8 pl-8">
        <span className="absolute top-2 bottom-2 left-[11px] w-px bg-border" aria-hidden />
        {STEPS.map(([tag, title, body], i) => (
          <Reveal key={tag} delay={i * 0.05}>
            <li className="relative">
              <span
                className="absolute top-1 -left-[29px] size-[15px] rounded-full border-2 border-background bg-primary"
                aria-hidden
              />
              <p className="font-mono text-xs tracking-widest text-muted-foreground">{tag}</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export function VerificationPreview() {
  return (
    <section className="border-y bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Verification"
            title="Three ways to check a certificate"
            description="A verifier needs nothing but the certificate itself — a hash, a QR code, or the document."
          />
          <ul className="mt-8 space-y-4">
            {[
              [ScanLine, "Scan the QR code", "Opens a verification result directly on a phone."],
              [Binary, "Paste the certificate hash", "Query the on-chain registry by fingerprint."],
              [Upload, "Upload the document", "Forensic comparison of document fields against the registry."],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof ScanLine;
              return (
                <li key={title as string} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-soft">
                    <I className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{title as string}</p>
                    <p className="text-sm text-muted-foreground">{body as string}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button asChild className="mt-8">
            <Link to="/verify">
              Open verification tool <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success-muted px-2.5 py-1 text-xs font-semibold text-success">
                <ShieldCheck className="size-3.5" aria-hidden /> CERTIFICATE VERIFIED
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{NETWORK.name}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-foreground">Aarav Krishnan</h3>
            <p className="text-sm text-muted-foreground">
              Bachelor of Technology in Computer Science and Engineering
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{ORGANIZATION.name}</p>
            <div className="mt-5 space-y-3">
              <HashDisplay label="Certificate hash" value={DEMO_HASHES.verified} />
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Hash Match", "PASS"],
                  ["Issuer Record", "VERIFIED"],
                  ["Revocation Status", "ACTIVE"],
                  ["Blockchain Record", "CONFIRMED"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border bg-card/70 px-3 py-2">
                    <p className="text-muted-foreground">{k}</p>
                    <p className="font-medium text-success">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <PrototypeNotice className="mt-5" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function IssuerWorkflow() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal>
        <SectionHeading
          eyebrow="For organizations"
          title="Issue credentials that speak for themselves"
          description="Single or bulk issuance, branded certificate templates, and revocation you can prove."
        />
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[
          [Building2, "Branded certificates", "Upload your logo, signature and template once; every certificate inherits it."],
          [FileCheck2, "Bulk issuance", "Upload a CSV, validate records, and anchor an entire graduating batch."],
          [ShieldAlert, "Provable revocation", "Revocation is recorded on-chain by the original issuer — it cannot be silently undone."],
        ].map(([Icon, title, body], i) => {
          const I = Icon as typeof Building2;
          return (
            <Reveal key={title as string} delay={i * 0.08}>
              <article className="h-full rounded-2xl border bg-card p-6 shadow-soft">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <I className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-base font-semibold text-foreground">{title as string}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body as string}</p>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function BlockchainProofSection() {
  return (
    <section className="border-y bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest text-navy-foreground/60 uppercase">
            The proof layer
          </p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            The registry answers, not the website.
          </h2>
          <p className="mt-4 max-w-lg text-sm text-navy-foreground/70">
            CertChainRegistry stores the certificate hash, the issuer wallet address, the issue
            timestamp and the revocation timestamp. Only the original issuer can revoke, and every
            state change is publicly auditable.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 font-mono text-xs backdrop-blur">
            <p className="text-navy-foreground/50">// CertChainRegistry.sol</p>
            <pre className="mt-3 overflow-x-auto leading-relaxed whitespace-pre">{`function issue(bytes32 certHash) external;
function revoke(bytes32 certHash) external;
function verify(bytes32 certHash)
  external view returns (
    address issuer,
    uint256 issuedAt,
    uint256 revokedAt
  );`}</pre>
            <div className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-[11px] text-navy-foreground/70 sm:grid-cols-2">
              <span>Contract · {NETWORK.contract}</span>
              <span>Chain ID · {NETWORK.chainId}</span>
              <span>Issuer · {shorten(ORGANIZATION.wallet, 6, 4)}</span>
              <span>Network · {NETWORK.name}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STATS = [
  ["SHA-256", "Hash algorithm"],
  ["Polygon Amoy", "Blockchain network"],
  ["<2 sec", "Target verification experience"],
  ["100%", "Tamper evidence"],
];

export function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(([value, label], i) => (
          <Reveal key={label} delay={i * 0.06}>
            <div className="rounded-2xl border bg-card p-6 text-center shadow-soft">
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Product positioning and prototype demo metrics — not measured production claims.
      </p>
    </section>
  );
}

export function ClosingCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <Reveal>
        <div className="glass-panel flex flex-col items-center gap-6 rounded-3xl px-6 py-14 text-center">
          <h2 className="max-w-xl text-3xl font-semibold text-foreground sm:text-4xl">
            Verify a certificate in the next ten seconds.
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Try the public verification tool with a demo certificate hash, or sign in to the issuer
            dashboard to see the full issuance workflow.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/verify">
                Verify a Certificate <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Issuer Login</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
