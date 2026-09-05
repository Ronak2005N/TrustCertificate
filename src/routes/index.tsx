import { createFileRoute } from "@tanstack/react-router";
import { PublicNav } from "@/components/layout/PublicNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import {
  BlockchainProofSection,
  ClosingCTA,
  HowItWorks,
  IssuerWorkflow,
  ProblemSection,
  Stats,
  ThreeLayers,
  TrustSignals,
  VerificationPreview,
} from "@/components/landing/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Certiproof — Blockchain certificate verification you can trust" },
      {
        name: "description",
        content:
          "Certiproof issues digitally signed academic certificates anchored on Polygon and lets anyone verify authenticity in seconds using SHA-256 proof.",
      },
      { property: "og:title", content: "Certiproof — Certificate verification you can trust" },
      {
        property: "og:description",
        content:
          "Blockchain-backed academic certificate issuance and independent cryptographic verification.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <Hero />
        <TrustSignals />
        <ProblemSection />
        <ThreeLayers />
        <HowItWorks />
        <VerificationPreview />
        <IssuerWorkflow />
        <BlockchainProofSection />
        <Stats />
        <ClosingCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
