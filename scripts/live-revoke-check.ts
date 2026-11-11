/**
 * live-revoke-check.ts — Task 10 live revocation check.
 *
 * TESTNET ONLY: Polygon Amoy (chainId 80002). Sends ONE real
 * revokeCertificate transaction paid in test POL via the REAL
 * `revokeCertificate()` application function (the same code path used by the
 * dashboard), driving it through the confirmation state machine, then
 * verifies the revocation across Methods A, B and C and the Supabase status
 * update.
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY must be the contract's superAdmin
 *     (revokeCertificate is onlySuperAdmin).
 *   - The target certificate must exist and currently be ACTIVE on-chain.
 *
 * Run:
 *   bun scripts/live-revoke-check.ts CERT-2026-NNNNNN
 *
 * Prints no private keys or raw env values.
 */
import { ethers } from "ethers";
import {
  analyzeDocument,
  fetchCertificateFromChain,
  fetchCertificateFromSupabase,
  verifyCertificate,
} from "../src/lib/certificates";
import { revokeCertificate } from "../src/lib/certificates";
import { buildQrPayload, extractHashFromQrPayload } from "./bench-verification";
import { generateCertificateBlob } from "../src/lib/pdf/generate-certificate";
import { POLYGON_AMOY, CONTRACT_ADDRESS, CERT_CHAIN_REGISTRY_ABI } from "../src/lib/blockchain/contracts";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`[revoke-check] ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Same minimal EIP-1193 shim pattern as bench-issuance.ts (headless MetaMask substitute). */
function createEip1193Shim(wallet: ethers.Wallet, rpc: ethers.JsonRpcProvider) {
  return {
    isMetaMask: true,
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [wallet.address];
        case "eth_chainId":
          return POLYGON_AMOY.chainIdHex;
        case "net_version":
          return String(POLYGON_AMOY.chainId);
        case "eth_sendTransaction": {
          const raw = (params?.[0] ?? {}) as Record<string, unknown>;
          const tx = await wallet.sendTransaction({
            chainId: POLYGON_AMOY.chainId,
            to: typeof raw.to === "string" ? raw.to : null,
            data: typeof raw.data === "string" ? raw.data : undefined,
            value: raw.value !== undefined ? BigInt(raw.value as string) : undefined,
            maxFeePerGas: raw.maxFeePerGas !== undefined ? BigInt(raw.maxFeePerGas as string) : undefined,
            maxPriorityFeePerGas:
              raw.maxPriorityFeePerGas !== undefined ? BigInt(raw.maxPriorityFeePerGas as string) : undefined,
          });
          return tx.hash;
        }
        default:
          return rpc.send(method, params ?? []);
      }
    },
    on: () => undefined,
    removeListener: () => undefined,
  };
}

async function main(): Promise<void> {
  const certId = process.argv[2];
  if (!certId || certId.startsWith("--")) {
    console.error("Usage: bun scripts/live-revoke-check.ts CERT-2026-NNNNNN");
    process.exit(1);
  }

  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) {
    console.error("[revoke-check] DEPLOYER_PRIVATE_KEY is not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(POLYGON_AMOY.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CERT_CHAIN_REGISTRY_ABI, provider);

  console.log(`[revoke-check] CertiProof Task-10 live revocation check — Polygon Amoy TESTNET`);
  console.log(`[revoke-check] target: ${certId} | admin: ${wallet.address}`);

  // --- Preflight: chain identity, admin rights, funds ---
  const network = await provider.getNetwork().catch(() => null);
  check("RPC reports chainId 80002", network?.chainId === BigInt(80002));
  const superAdmin = (await contract.superAdmin!().catch(() => null)) as string | null;
  check("wallet is the contract superAdmin", superAdmin?.toLowerCase() === wallet.address.toLowerCase());
  const balance = await provider.getBalance(wallet.address).catch(() => null);
  check("wallet has test POL for gas", balance !== null && balance > 0n, balance !== null ? `${ethers.formatEther(balance)} POL` : "unreadable");

  // --- Step 1: pre-state — initially valid ---
  const preChain = await fetchCertificateFromChain(certId);
  check("certificate exists on-chain", preChain !== null);
  if (!preChain) {
    console.error("[revoke-check] aborting — nothing to revoke");
    process.exit(1);
  }
  check("certificate is ACTIVE before revocation", preChain.status === "active", `status=${preChain.status}`);
  const preA = await verifyCertificate(preChain.hash);
  check("Method A reports verified BEFORE revocation", preA.outcome === "verified", `outcome=${preA.outcome}`);
  const preRow = await fetchCertificateFromSupabase(certId);
  check("Supabase row exists BEFORE revocation", preRow !== null);

  // --- Step 2: REAL revocation through the application function ---
  console.log("[revoke-check] revoking via the real revokeCertificate() (confirmation machine inside)…");
  (globalThis as Record<string, unknown>)["window"] = {
    ethereum: createEip1193Shim(wallet, provider),
  };
  const revoked = await revokeCertificate(certId);
  check("revokeCertificate returned status=revoked", revoked.status === "revoked");
  const txHash = revoked.chain.transactionHash;
  check("revocation tx hash preserved", /^0x[0-9a-fA-F]{64}$/.test(txHash), `tx=${txHash.slice(0, 10)}…`);

  // --- Steps 3–5: REAL mined receipt + chain status ---
  const receipt = txHash ? await provider.getTransactionReceipt(txHash).catch(() => null) : null;
  check("revocation receipt exists (REAL mined)", receipt !== null);
  check("revocation receipt status === 1", receipt?.status === 1);
  check("revocation receipt blockNumber > 0", (receipt?.blockNumber ?? 0) > 0, `block #${receipt?.blockNumber}`);
  const postChain = await fetchCertificateFromChain(certId);
  check("chain status is REVOKED after mined receipt", postChain?.status === "revoked", `status=${postChain?.status}`);

  // --- Steps 6–8: Methods A / B / C report revocation per documented semantics ---
  const a = await verifyCertificate(preChain.hash);
  check("Method A outcome === revoked", a.outcome === "revoked", `outcome=${a.outcome}`);
  const revocationCheck = a.checks.find((c) => c.label === "Revocation Status");
  check("Method A Revocation Status check = REVOKED (pass=false)", revocationCheck?.pass === false && revocationCheck?.value === "REVOKED");

  const extractedHash = extractHashFromQrPayload(buildQrPayload(preChain.hash));
  const b = await verifyCertificate(extractedHash ?? "");
  check("Method B outcome === revoked (consistent with A)", b.outcome === "revoked", `outcome=${b.outcome}`);

  // Method C authentic PDF: document identity is unchanged by revocation —
  // expected outcome is "match" with certificate.status surfaced as revoked.
  if (preRow) {
    const blob = await generateCertificateBlob({
      id: certId,
      recipientName: preRow.recipientName,
      course: preRow.course,
      organization: preRow.organization,
      issueDate: preRow.issueDate,
      certificateNumber: certId,
    });
    const file = new File([new Uint8Array(await blob.arrayBuffer())], "post-revoke.pdf", {
      type: "application/pdf",
    });
    const c = await analyzeDocument(file);
    check("Method C outcome === match (document identity intact)", c.outcome === "match", `outcome=${c.outcome}`);
    check("Method C surfaces chain status = revoked", c.certificate?.status === "revoked", `status=${c.certificate?.status}`);
  }

  // --- Supabase: status update ran only after the mined receipt, hash-guarded ---
  const postRow = await fetchCertificateFromSupabase(certId);
  check("Supabase row status updated to revoked (post-receipt)", postRow?.status === "revoked", `status=${postRow?.status}`);
  check("Supabase row hash unchanged by the status update", postRow?.hash.toLowerCase() === preChain.hash.toLowerCase());

  if (failures > 0) {
    console.error(`[revoke-check] ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("[revoke-check] all checks PASSED");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[revoke-check] fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
