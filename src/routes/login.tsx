import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Wallet, AlertCircle } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { useWallet } from "@/lib/hooks/useWallet";
import { checkIssuerAuth } from "@/lib/blockchain/verify";
import { CONTRACT_ADDRESS } from "@/lib/blockchain/contracts";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Issuer Login — Certiproof" },
      {
        name: "description",
        content:
          "Sign in to the Certiproof issuer dashboard to issue, manage and revoke blockchain-anchored certificates.",
      },
      { property: "og:title", content: "Issuer Login — Certiproof" },
      { property: "og:description", content: "Access the Certiproof issuer dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { connect, isConnected, isAmoy, address, shortenAddress, error, isConnecting, switchNetwork } = useWallet();
  const [checking, setChecking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleConnect() {
    if (!isConnected) {
      await connect();
      return;
    }

    if (!isAmoy) {
      await switchNetwork();
      return;
    }

    // Check if wallet is authorized issuer
    setChecking(true);
    setAuthError(null);

    try {
      const isAuthorized = await checkIssuerAuth(address);

      if (!isAuthorized) {
        setAuthError(
          "This wallet is not authorized to issue certificates. Only the Super Admin or authorized issuers can access the dashboard."
        );
        toast.error("Unauthorized issuer");
        return;
      }

      toast.success("Issuer authorized! Welcome to Certiproof.");
      void navigate({ to: "/dashboard" });
    } catch {
      setAuthError("Failed to verify issuer authorization. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  const needsInstall = !isConnected && typeof window !== "undefined" && !window.ethereum;
  const buttonLabel = checking
    ? "Verifying authorization..."
    : needsInstall
      ? "Install MetaMask"
      : !isConnected
        ? "Connect MetaMask"
        : !isAmoy
          ? "Switch to Polygon Amoy"
          : "Enter Dashboard";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-navy p-10 text-navy-foreground lg:flex">
        <Link to="/" className="flex w-fit items-center gap-2">
          <Logo compact />
          <span className="text-[15px] font-semibold">Certiproof</span>
        </Link>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold">Issue credentials that speak for themselves.</h1>
          <p className="mt-4 text-sm text-navy-foreground/70">
            Anchor every certificate to a public registry, so employers and institutions can confirm
            authenticity without asking you for confirmation.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-navy-foreground/80">
            {["SHA-256 fingerprint per certificate", "On-chain issuance and revocation", "Bulk issuance for entire batches"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <p className="font-mono text-xs text-navy-foreground/50">
          CertChainRegistry · Polygon Amoy Testnet
        </p>
      </section>

      <section className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="size-4" /> Back to home
          </Link>

          <h2 className="text-2xl font-semibold text-foreground">Issuer login</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Connect your MetaMask wallet to access the issuing dashboard.
          </p>

          <div className="mt-8 space-y-4">
            {isConnected && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`size-2 rounded-full ${isAmoy ? "bg-green-500" : "bg-yellow-500"}`} />
                  <span className="font-mono text-foreground">{shortenAddress(address)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAmoy ? "Polygon Amoy" : "Wrong network — switch to continue"}
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {authError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                {authError}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={checking || needsInstall}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wallet className="size-4" />
              )}
              {buttonLabel}
            </button>

            {needsInstall && (
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-primary hover:underline"
              >
                Download MetaMask →
              </a>
            )}
          </div>

          <div className="mt-8 rounded-lg border p-4">
            <h3 className="text-sm font-medium text-foreground">How it works</h3>
            <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">1.</span>
                Connect your MetaMask wallet
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">2.</span>
                Switch to Polygon Amoy testnet
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">3.</span>
                Your wallet must be an authorized issuer on the smart contract
              </li>
            </ol>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Contract: <span className="font-mono">{CONTRACT_ADDRESS ? `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}` : "Not deployed"}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
