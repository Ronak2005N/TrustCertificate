import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, Binary, FileText, Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NETWORK } from "@/lib/demo-data";

const CHIPS = ["SHA-256", "On-chain registry", "Tamper-evident"];

const FLOW = [
  { icon: FileText, title: "Certificate", detail: "Aarav Krishnan · B.Tech CSE" },
  { icon: Binary, title: "SHA-256 hash", detail: "0x8f4c7e…b92a", mono: true },
  { icon: Link2, title: "Blockchain record", detail: "Polygon Amoy · block 12,884,301" },
  { icon: ShieldCheck, title: "Verified", detail: "Issuer confirmed · Not revoked", success: true },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="surface-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_55%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {NETWORK.name}
          </span>

          <h1 className="mt-5 text-4xl leading-[1.08] font-semibold text-foreground sm:text-5xl lg:text-[3.4rem]">
            Certificate verification you can trust.
          </h1>

          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Issue digitally signed certificates anchored on blockchain. Verify authenticity in
            seconds with cryptographic proof — not trust in a website.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {CHIPS.map((chip) => (
              <li
                key={chip}
                className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {chip}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/verify">
                Verify a Certificate
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Issue Certificates</Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="flex flex-col gap-3">
            {FLOW.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="glass-panel flex items-center gap-4 rounded-2xl px-4 py-3.5">
                  <span
                    className={
                      step.success
                        ? "flex size-9 items-center justify-center rounded-lg bg-success-muted text-success"
                        : "flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                    }
                  >
                    <step.icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p
                      className={
                        step.mono
                          ? "truncate font-mono text-xs text-muted-foreground"
                          : "truncate text-xs text-muted-foreground"
                      }
                    >
                      {step.detail}
                    </p>
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="ml-[34px] block h-3 w-px bg-border" aria-hidden />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
