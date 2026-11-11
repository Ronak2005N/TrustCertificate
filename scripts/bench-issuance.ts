/**
 * bench-issuance.ts — REAL end-to-end certificate issuance measurement harness.
 *
 * TESTNET ONLY: Polygon Amoy (chainId 80002). Every successful run sends a
 * REAL registerCertificate transaction paid in test POL and pins a REAL
 * file to IPFS via the application's server-side Pinata handler.
 *
 * Run:
 *   bun scripts/bench-issuance.ts            (10 runs, the default target)
 *   bun scripts/bench-issuance.ts --runs=3
 *
 * Output:
 *   benchmarks/issuance-results.json         (machine-readable raw results + stats)
 *
 * What is executed:
 *   The REAL `issueCertificate` function from src/lib/certificates.ts — the
 *   same code path used by the /issue page. Adaptations for a headless
 *   environment (documented, no app code changed):
 *   - Wallet: DEPLOYER_PRIVATE_KEY (an authorized issuer) exposed through a
 *     minimal EIP-1193 shim instead of MetaMask. No private key is logged
 *     or written to any output file.
 *   - IPFS: the real server-function chain runs in-process via a seeded
 *     TanStack Start context; only the browser→server HTTP RPC hop of the
 *     server function is absent (the real Pinata handler, validation and
 *     credential usage are identical).
 *
 * Boundaries:
 *   totalIssuanceMs START = issueCertificate() invoked
 *                 END   = issueCertificate() returns the Certificate.
 *   Supabase persistence is fire-and-forget in the application and is
 *   therefore measured separately (supabasePersistenceMs), not included
 *   in totalIssuanceMs.
 *
 * QR generation is NOT part of the issuance pipeline (the CertificatePreview
 * React component renders the QR after issuance); it is measured once as a
 * clearly separated microbenchmark.
 */
import { ethers } from "ethers";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { runWithStartContext } from "@tanstack/start-storage-context";
import {
  getLastIssuanceFailure,
  getLastIssuanceTimings,
  setIssuanceTimingLogger,
  waitForPendingNonBlockingStages,
  type IssuanceTimings,
} from "../src/lib/issuance-timing";
import { issueCertificate, type IssueInput } from "../src/lib/certificates";
import {
  CERT_CHAIN_REGISTRY_ABI,
  CONTRACT_ADDRESS,
  POLYGON_AMOY,
} from "../src/lib/blockchain/contracts";

interface SuccessfulRun {
  run: number;
  ok: true;
  certificateId: string;
  fingerprintGenerationMs: number;
  pdfGenerationMs: number;
  ipfsUploadMs: number;
  blockchainPreparationMs: number;
  blockchainSubmissionMs: number;
  blockchainConfirmationMs: number;
  supabasePersistenceMs: number | null;
  qrGenerationMs: null;
  totalIssuanceMs: number;
  transactionHash: string;
  cid: string;
}

interface FailedRun {
  run: number;
  ok: false;
  failedStage: string;
  errorCategory: string;
  transactionSubmitted: boolean;
  transactionHash: string | null;
  totalMsUntilFailure: number | null;
  message: string;
}

interface Stats {
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

function stats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  const variance =
    n > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    min: round(sorted[0]!),
    max: round(sorted[n - 1]!),
    mean: round(mean),
    median: round(median),
    stdDev: round(Math.sqrt(variance)),
  };
}

function abort(message: string): never {
  console.error(`[bench-issuance] ABORT: ${message}`);
  process.exit(1);
}

function parseRunsArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--runs="));
  if (!arg) return 10;
  const n = Number(arg.slice("--runs=".length));
  if (!Number.isInteger(n) || n < 1 || n > 50) abort("--runs must be an integer between 1 and 50");
  return n;
}

/**
 * Minimal EIP-1193 provider backed by a real ethers Wallet on Polygon Amoy.
 * eth_sendTransaction signs locally with the wallet; all other methods
 * pass through to the public RPC unchanged.
 */
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
          if (
            typeof raw.from === "string" &&
            raw.from.toLowerCase() !== wallet.address.toLowerCase()
          ) {
            throw Object.assign(new Error("from address mismatch"), { code: -32000 });
          }
          const txReq: ethers.TransactionRequest = {
            chainId: POLYGON_AMOY.chainId,
            to: typeof raw.to === "string" ? raw.to : null,
            data: typeof raw.data === "string" ? raw.data : undefined,
            value: raw.value !== undefined ? BigInt(raw.value as string) : undefined,
            gasLimit:
              raw.gas !== undefined
                ? BigInt(raw.gas as string)
                : raw.gasLimit !== undefined
                  ? BigInt(raw.gasLimit as string)
                  : undefined,
            maxFeePerGas:
              raw.maxFeePerGas !== undefined ? BigInt(raw.maxFeePerGas as string) : undefined,
            maxPriorityFeePerGas:
              raw.maxPriorityFeePerGas !== undefined
                ? BigInt(raw.maxPriorityFeePerGas as string)
                : undefined,
            nonce: raw.nonce !== undefined ? Number(BigInt(raw.nonce as string)) : undefined,
          };
          const tx = await wallet.sendTransaction(txReq);
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

/**
 * TanStack Start server-function transport bridge.
 *
 * Outside the Vite build, `createServerFn().handler(fn)` keeps the raw
 * handler as `extractedFn`. The middleware protocol expects extractedFn
 * to return a context object with a `result` field; the raw handler
 * returns the bare value. This global function-middleware (seeded through
 * the Start context, the documented extension point) rebuilds the
 * envelope so the real in-process server handler can run. It replicates
 * only the transport envelope — validation, Pinata upload and credential
 * handling all run in the genuine application server code.
 */
const serverFnTransportBridge = {
  options: {
    client: async ({
      next,
    }: {
      next: (ctx?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }) => {
      const r = await next();
      if (r && r["result"] === undefined && typeof r["ok"] === "boolean") {
        const rebuilt: Record<string, unknown> = { ok: r["ok"] };
        for (const key of ["cid", "url", "message"]) {
          if (r[key] !== undefined) rebuilt[key] = r[key];
        }
        return { ...r, result: rebuilt };
      }
      return r;
    },
  },
};

const startContext = {
  startOptions: { functionMiddleware: [serverFnTransportBridge] },
  contextAfterGlobalMiddlewares: {},
};

function toRunRecord(run: number, t: IssuanceTimings): SuccessfulRun {
  return {
    run,
    ok: true,
    certificateId: t.certificateId,
    fingerprintGenerationMs: round(t.fingerprintGenerationMs),
    pdfGenerationMs: round(t.pdfGenerationMs),
    ipfsUploadMs: round(t.ipfsUploadMs),
    blockchainPreparationMs: round(t.blockchainPreparationMs),
    blockchainSubmissionMs: round(t.blockchainSubmissionMs),
    blockchainConfirmationMs: round(t.blockchainConfirmationMs),
    supabasePersistenceMs: t.supabasePersistenceMs === null ? null : round(t.supabasePersistenceMs),
    qrGenerationMs: null,
    totalIssuanceMs: round(t.totalIssuanceMs),
    transactionHash: t.transactionHash,
    cid: t.cid,
  };
}

async function main(): Promise<void> {
  const runsRequested = parseRunsArg();

  // --- Environment preflight (no secrets printed) ---
  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) abort("DEPLOYER_PRIVATE_KEY is not set in .env");
  if (!CONTRACT_ADDRESS) abort("VITE_CONTRACT_ADDRESS is not set in .env");
  if (!process.env["PINATA_JWT"]) abort("PINATA_JWT is not set in .env (required for IPFS stage)");
  if (!process.env["VITE_SUPABASE_URL"] || !process.env["VITE_SUPABASE_ANON_KEY"]) {
    abort("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(POLYGON_AMOY.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("[bench-issuance] CertiProof issuance benchmark — Polygon Amoy TESTNET (chainId 80002)");
  console.log(`[bench-issuance] contract:  ${CONTRACT_ADDRESS}`);
  console.log(`[bench-issuance] issuer:    ${wallet.address}`);

  const network = await provider.getNetwork().catch(() => null);
  if (!network || network.chainId !== BigInt(POLYGON_AMOY.chainId)) {
    abort(`RPC did not report chainId ${POLYGON_AMOY.chainId} — refusing to continue`);
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CERT_CHAIN_REGISTRY_ABI, provider);
  const authorized = await contract.isAuthorizedIssuer!(wallet.address).catch(() => null);
  if (authorized !== true) abort("Issuer address is not an authorized issuer on the contract");

  const balance = await provider.getBalance(wallet.address).catch(() => null);
  if (balance === null) abort("Could not read issuer balance");
  if (balance < ethers.parseEther("0.05")) {
    abort(`Insufficient test POL for ${runsRequested} runs: ${ethers.formatEther(balance)} POL`);
  }
  console.log(`[bench-issuance] balance:    ${ethers.formatEther(balance)} POL (testnet)`);

  // --- Headless MetaMask substitute ---
  (globalThis as Record<string, unknown>)["window"] = {
    ethereum: createEip1193Shim(wallet, provider),
  };
  setIssuanceTimingLogger(null); // harness prints its own structured output

  const today = new Date().toISOString().slice(0, 10);
  const runs: SuccessfulRun[] = [];
  const failures: FailedRun[] = [];

  for (let run = 1; run <= runsRequested; run++) {
    const input: IssueInput = {
      recipientName: `Bench Recipient ${run}`,
      recipientEmail: `bench${run}@example.edu`,
      course: `Benchmark Course ${run}`,
      type: "Completion",
      issueDate: today,
      description: "Automated testnet benchmark run (Polygon Amoy).",
    };

    process.stdout.write(`[bench-issuance] run ${run}/${runsRequested}: issuing… `);
    try {
      const cert = await runWithStartContext(startContext, () => issueCertificate(input));
      await waitForPendingNonBlockingStages();
      const timings = getLastIssuanceTimings();
      if (!timings) abort("issueCertificate succeeded but no timings were recorded");
      const record = toRunRecord(run, timings);
      runs.push(record);
      console.log(
        `OK total=${record.totalIssuanceMs}ms ` +
          `fingerprint=${record.fingerprintGenerationMs}ms pdf=${record.pdfGenerationMs}ms ` +
          `ipfs=${record.ipfsUploadMs}ms prep=${record.blockchainPreparationMs}ms ` +
          `submit=${record.blockchainSubmissionMs}ms confirm=${record.blockchainConfirmationMs}ms ` +
          `supabase=${record.supabasePersistenceMs ?? "pending"}ms ` +
          `tx=${record.transactionHash.slice(0, 10)}… cid=${record.cid.slice(0, 12)}…`,
      );
    } catch (err) {
      const failure = getLastIssuanceFailure();
      const failedRun: FailedRun = {
        run,
        ok: false,
        failedStage: failure?.failedStage ?? "unknown",
        errorCategory: failure?.errorCategory ?? "unknown",
        transactionSubmitted: failure?.transactionSubmitted ?? false,
        transactionHash: failure?.transactionHash ?? null,
        totalMsUntilFailure:
          failure?.totalMsUntilFailure != null ? round(failure.totalMsUntilFailure) : null,
        message:
          err instanceof Error
            ? err.message
            : ((err as { message?: string }).message ?? String(err)),
      };
      failures.push(failedRun);
      console.log(
        `FAILED at ${failedRun.failedStage} (${failedRun.errorCategory})` +
          `${failedRun.transactionHash ? ` tx=${failedRun.transactionHash.slice(0, 10)}…` : ""}: ${failedRun.message}`,
      );
    }
    // Guard against same-millisecond certificate-ID collisions (ID is Date.now-based).
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // --- QR microbenchmark (clearly separated from issuance) ---
  const qrStart = performance.now();
  await QRCode.toDataURL(`https://certiproof.app/verify/0x${"ab".repeat(32)}`, {
    width: 256,
    margin: 1,
    color: { dark: "#1b2337", light: "#ffffff" },
  });
  const qrGenerationMs = round(performance.now() - qrStart);

  // --- Stats over successful runs only ---
  const metricKeys = [
    "fingerprintGenerationMs",
    "pdfGenerationMs",
    "ipfsUploadMs",
    "blockchainPreparationMs",
    "blockchainSubmissionMs",
    "blockchainConfirmationMs",
    "supabasePersistenceMs",
    "totalIssuanceMs",
  ] as const;

  const statsOut: Record<string, Stats | null> = {};
  for (const key of metricKeys) {
    const values = runs
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    statsOut[key] = stats(values);
  }

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      harness: "scripts/bench-issuance.ts",
      network: "Polygon Amoy (TESTNET)",
      chainId: POLYGON_AMOY.chainId,
      contractAddress: CONTRACT_ADDRESS,
      issuerAddress: wallet.address,
      runsRequested,
      runsSucceeded: runs.length,
      runsFailed: failures.length,
      timingBoundaries: {
        totalIssuanceMs:
          "START: issueCertificate() invoked. END: issueCertificate() returns the Certificate. Excludes the fire-and-forget Supabase insert (measured separately as supabasePersistenceMs).",
        fingerprintGenerationMs:
          "generateCertificateFingerprint() — canonical metadata SHA-256.",
        pdfGenerationMs: "generateCertificateBlob() — jsPDF document generation.",
        ipfsUploadMs:
          "uploadToIPFS() — real server-function chain in-process: FormData validation + Pinata pin + CID return (browser→server HTTP RPC hop absent).",
        blockchainPreparationMs:
          "getSigner() + getContract(signer) — wallet/signer and contract wiring.",
        blockchainSubmissionMs:
          "registerCertificate(...) call until the transaction response/hash is returned (includes ethers' propagation poll until the node can serve the transaction).",
        blockchainConfirmationMs:
          "waitForTransactionConfirmation() — tx.wait() raced against the application's 60s confirmation timeout, with one final receipt check on timeout. Resolves only from a real mined receipt; a timeout with no receipt is recorded as a FAILED run (category confirmation_pending) — never as success.",
        supabasePersistenceMs:
          "saveCertificateToSupabase() insert; fire-and-forget in the real app, awaited only by the harness.",
      },
      notes: [
        "All runs are REAL Polygon Amoy testnet transactions paid in test POL. No mainnet activity.",
        "Signer: DEPLOYER_PRIVATE_KEY through an EIP-1193 shim (no MetaMask popup). Private key never logged or stored.",
        "QR generation is render-time (CertificatePreview) and not part of issuance; measured once as a separate microbenchmark.",
        "stdDev is the sample standard deviation (n-1).",
      ],
    },
    runs,
    failures,
    microbenchmarks: {
      qrGenerationMs,
      note: "Single run of QRCode.toDataURL (same options as CertificatePreview). Not part of the issuance pipeline.",
    },
    stats: statsOut,
  };

  const outDir = path.join(import.meta.dir, "..", "benchmarks");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "issuance-results.json");
  writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");

  console.log("\n[bench-issuance] === SUMMARY (successful runs only) ===");
  for (const key of metricKeys) {
    const s = statsOut[key];
    if (!s) {
      console.log(`  ${key}: unavailable (no data)`);
      continue;
    }
    console.log(
      `  ${key}: n=${s.n} min=${s.min} max=${s.max} mean=${s.mean} median=${s.median} stdDev=${s.stdDev}`,
    );
  }
  console.log(`  qrGenerationMs (separate microbenchmark): ${qrGenerationMs}`);
  console.log(`\n[bench-issuance] raw results written to ${outFile}`);
  console.log(
    `[bench-issuance] done: ${runs.length} succeeded, ${failures.length} failed (of ${runsRequested} requested)`,
  );

  // Confirmation timers are cleared by the application's state machine; no timer cleanup needed here.
  process.exit(failures.length > 0 && runs.length === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[bench-issuance] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
