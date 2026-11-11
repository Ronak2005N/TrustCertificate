/**
 * bench-ipfs.ts — REAL IPFS/Pinata upload, retrieval, integrity, reliability
 * and performance harness for CertiProof.
 *
 * Every successful upload is a REAL Pinata pin made through the application's
 * own server-side upload path (uploadToIPFS → server function → pinata.ts →
 * Pinata). Every retrieval is a REAL gateway GET of the returned CID. Integrity
 * is proven by SHA-256(original bytes) === SHA-256(retrieved bytes); an HTTP
 * 200 alone is NEVER treated as success.
 *
 * Run:
 *   bun scripts/bench-ipfs.ts                 (full scope: 7 sizes × 5 runs)
 *   bun scripts/bench-ipfs.ts --runs=3
 *
 * Output:
 *   benchmarks/ipfs-results.json              (machine-readable raw results + stats)
 *
 * Phases:
 *   A. Real certificate PDF — generated with the application's jsPDF generator,
 *      uploaded through uploadToIPFS, retrieved immediately, then re-retrieved
 *      after the size sweep (delayed re-verification).
 *   B. Size sweep — deterministic synthetic files at 10 KB, 100 KB, 500 KB,
 *      1 MB, 2 MB, 5 MB and 10 MB (the application's maximum), N runs each.
 *      Every run's content is unique (seeded per size+run) so each upload is
 *      genuinely new content.
 *   C. Repeated uploads — the exact same file uploaded twice, and a different
 *      file uploaded, to observe content-addressed CID behavior.
 *   D. Error probes — live, safe failure-path checks (missing credential,
 *      invalid credential, malformed request, unknown CID retrieval). No
 *      secret is printed; the real credential is never rotated.
 *
 * Cleanup:
 *   Every pin created by this harness is unpinned afterwards via Pinata's
 *   DELETE /pinning/unpin/{cid} (verified available before this full-scope
 *   benchmark was chosen). Unpin results are recorded honestly.
 *
 * Boundaries:
 *   uploadMs    START: uploadToIPFS(file) invoked (in-process server-fn
 *               chain, same convention as bench-issuance ipfsUploadMs —
 *               only the browser→server HTTP RPC hop is absent).
 *               END: CID + gateway URL returned.
 *   retrievalMs START: gateway GET of the app-returned URL issued.
 *               END: full body read (arrayBuffer) of a non-empty 2xx response.
 *               The first successful attempt's duration is used; failed
 *               attempts are recorded per run.
 *
 * NOT measured / NOT compared here:
 *   metadataFingerprint (certificate registry identity) is a DIFFERENT
 *   domain from documentByteHash (file-byte integrity). This harness only
 *   ever compares original file bytes against retrieved file bytes.
 *
 * Secrets: PINATA_JWT is read only through the server-side environment and
 * is never printed, logged, or written to any output file.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { uploadToIPFS } from "../src/lib/ipfs";
import { pinFileToIpfs, uploadCertificateFile } from "../src/lib/server/pinata";
import { generateCertificateBlob } from "../src/lib/pdf/generate-certificate";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";
const UNPIN_URL_BASE = "https://api.pinata.cloud/pinning/unpin";
const RETRIEVAL_ATTEMPTS = 3;
const RETRIEVAL_RETRY_DELAY_MS = 2500;
const RETRIEVAL_TIMEOUT_MS = 60_000;
const INTER_CYCLE_PAUSE_MS = 250;
const INVALID_CREDENTIAL_PROBE_TOKEN = "invalid-credential-probe-token-do-not-use";

const SIZES = [
  { label: "10KB", bytes: 10 * 1024 },
  { label: "100KB", bytes: 100 * 1024 },
  { label: "500KB", bytes: 500 * 1024 },
  { label: "1MB", bytes: 1024 * 1024 },
  { label: "2MB", bytes: 2 * 1024 * 1024 },
  { label: "5MB", bytes: 5 * 1024 * 1024 },
  { label: "10MB", bytes: 10 * 1024 * 1024 },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Stats {
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
}

interface RetrievalAttemptRecord {
  attempt: number;
  ok: boolean;
  httpStatus: number | null;
  durationMs: number;
  error: string | null;
}

interface CycleRecord {
  phase: "certificate-pdf" | "size-sweep";
  label: string;
  run: number;
  ok: boolean;
  fileBytes: number | null;
  uploadMs: number | null;
  cid: string | null;
  url: string | null;
  originalSha256: string | null;
  retrievalAttempts: RetrievalAttemptRecord[];
  firstAttemptRetrievalOk: boolean;
  retrievalOk: boolean;
  retrievalMs: number | null;
  retrievedSha256: string | null;
  integrityOk: boolean | null;
  unpinOk: boolean | null;
  error: string | null;
}

interface DelayedRecheckRecord {
  performed: boolean;
  elapsedSinceUploadMs: number | null;
  retrievalMs: number | null;
  httpStatus: number | null;
  retrievedSha256: string | null;
  integrityOk: boolean | null;
  error: string | null;
}

interface DedupRecord {
  uploadSameFile1: { ok: boolean; cid: string | null; uploadMs: number | null; error: string | null };
  uploadSameFile2: { ok: boolean; cid: string | null; uploadMs: number | null; error: string | null };
  uploadDifferentFile: { ok: boolean; cid: string | null; uploadMs: number | null; error: string | null };
  sameFileCidEqual: boolean | null;
  differentFileCidEqual: boolean | null;
  unpinResults: Array<{ cid: string; ok: boolean; httpStatus: number | null }>;
}

interface ErrorProbeRecord {
  probe: string;
  expectedFailure: boolean;
  behavedAsExpected: boolean;
  resultSummary: string;
  secretLeaked: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round = (value: number): number => Math.round(value * 100) / 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  const variance = n > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
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
  console.error(`[bench-ipfs] ABORT: ${message}`);
  process.exit(1);
}

function parseRunsArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--runs="));
  if (!arg) return 5;
  const n = Number(arg.slice("--runs=".length));
  if (!Number.isInteger(n) || n < 1 || n > 20) abort("--runs must be an integer between 1 and 20");
  return n;
}

function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Deterministic PRNG (mulberry32) for reproducible synthetic content. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic synthetic bytes; same (bytes, seed) always yields the same content. */
function syntheticBytes(bytes: number, seed: number): Uint8Array {
  const rand = mulberry32(seed);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) out[i] = Math.floor(rand() * 256);
  return out;
}

function makeSyntheticPdf(bytes: number, seed: number, name: string): File {
  return new File([syntheticBytes(bytes, seed)], name, { type: "application/pdf" });
}

function formWithFile(file: File): FormData {
  const form = new FormData();
  form.append("file", file, file.name);
  return form;
}

/**
 * TanStack Start server-function transport bridge — identical to the one in
 * bench-issuance.ts. Rebuilds only the transport envelope so the REAL
 * in-process server handler (validation + Pinata + credential) can run
 * outside the Vite build. No application code is changed.
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

/** Upload through the exact abstraction the application uses (uploadToIPFS). */
async function uploadViaApp(file: File): Promise<{ cid: string; url: string; uploadMs: number }> {
  const t0 = performance.now();
  const result = await runWithStartContext(startContext, () => uploadToIPFS(file));
  return { cid: result.cid, url: result.url, uploadMs: performance.now() - t0 };
}

/**
 * Retrieve content for a CID via the app-returned gateway URL. Retries up to
 * RETRIEVAL_ATTEMPTS times; every attempt is recorded honestly. A run only
 * counts as retrieved when a 2xx response with a non-empty body is fully read.
 */
async function retrieveWithAttempts(
  url: string,
): Promise<{ attempts: RetrievalAttemptRecord[]; bytes: Uint8Array | null; retrievalMs: number | null }> {
  const attempts: RetrievalAttemptRecord[] = [];
  for (let attempt = 1; attempt <= RETRIEVAL_ATTEMPTS; attempt++) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(RETRIEVAL_TIMEOUT_MS) });
      if (!res.ok) {
        attempts.push({
          attempt,
          ok: false,
          httpStatus: res.status,
          durationMs: round(performance.now() - t0),
          error: `HTTP ${res.status}`,
        });
      } else {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const durationMs = round(performance.now() - t0);
        if (bytes.length === 0) {
          attempts.push({ attempt, ok: false, httpStatus: res.status, durationMs, error: "empty body" });
        } else {
          attempts.push({ attempt, ok: true, httpStatus: res.status, durationMs, error: null });
          return { attempts, bytes, retrievalMs: durationMs };
        }
      }
    } catch (err) {
      attempts.push({
        attempt,
        ok: false,
        httpStatus: null,
        durationMs: round(performance.now() - t0),
        error: errorMessage(err),
      });
    }
    if (attempt < RETRIEVAL_ATTEMPTS) await sleep(RETRIEVAL_RETRY_DELAY_MS);
  }
  return { attempts, bytes: null, retrievalMs: null };
}

/** Pinata unpin cleanup for a single pin created by this harness. */
async function unpinCid(cid: string): Promise<{ ok: boolean; httpStatus: number | null }> {
  const jwt = process.env["PINATA_JWT"];
  if (!jwt) return { ok: false, httpStatus: null };
  try {
    const res = await fetch(`${UNPIN_URL_BASE}/${cid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(30_000),
    });
    return { ok: res.ok, httpStatus: res.status };
  } catch {
    return { ok: false, httpStatus: null };
  }
}

/**
 * One full upload → retrieve → integrity cycle through the application path.
 * `cleanup` (default true) unpins the CID afterwards.
 */
async function runCycle(
  phase: CycleRecord["phase"],
  label: string,
  run: number,
  file: File,
  cleanup = true,
): Promise<CycleRecord> {
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const originalSha256 = sha256Hex(originalBytes);

  let uploadMs: number | null = null;
  let cid: string | null = null;
  let url: string | null = null;
  try {
    const uploaded = await uploadViaApp(file);
    uploadMs = round(uploaded.uploadMs);
    cid = uploaded.cid;
    url = uploaded.url;
  } catch (err) {
    return {
      phase,
      label,
      run,
      ok: false,
      fileBytes: originalBytes.length,
      uploadMs,
      cid: null,
      url: null,
      originalSha256,
      retrievalAttempts: [],
      firstAttemptRetrievalOk: false,
      retrievalOk: false,
      retrievalMs: null,
      retrievedSha256: null,
      integrityOk: null,
      unpinOk: null,
      error: errorMessage(err),
    };
  }

  const retrieval = await retrieveWithAttempts(url);
  const retrievedSha256 = retrieval.bytes ? sha256Hex(retrieval.bytes) : null;
  const integrityOk = retrieval.bytes ? retrievedSha256 === originalSha256 : null;

  let unpinOk: boolean | null = null;
  if (cleanup) {
    unpinOk = (await unpinCid(cid)).ok;
  }

  return {
    phase,
    label,
    run,
    ok: true,
    fileBytes: originalBytes.length,
    uploadMs,
    cid,
    url,
    originalSha256,
    retrievalAttempts: retrieval.attempts,
    firstAttemptRetrievalOk: retrieval.attempts[0]?.ok === true,
    retrievalOk: retrieval.bytes !== null,
    retrievalMs: retrieval.retrievalMs,
    retrievedSha256,
    integrityOk,
    unpinOk,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const runsPerSize = parseRunsArg();

  if (!process.env["PINATA_JWT"]) abort("PINATA_JWT is not set in .env (required — server-side only)");

  console.log("[bench-ipfs] CertiProof IPFS benchmark — REAL Pinata pin + gateway retrieval");
  console.log(`[bench-ipfs] scope: ${SIZES.length} sizes × ${runsPerSize} runs + certificate PDF + dedup + error probes`);
  console.log(`[bench-ipfs] gateway: ${GATEWAY_BASE}`);

  const cycles: CycleRecord[] = [];
  const cleanupQueue: string[] = [];

  // --- Phase A: real certificate PDF (upload + immediate retrieval) ---
  console.log("\n[bench-ipfs] phase A: real certificate PDF via the app's generator + upload path");
  const certBlob = await generateCertificateBlob({
    id: "CERT-BENCH-IPFS",
    recipientName: "IPFS Benchmark Recipient",
    course: "IPFS Reliability Benchmark",
    organization: "CertiProof Benchmark Harness",
    issueDate: new Date().toISOString().slice(0, 10),
    certificateNumber: "CERT-BENCH-IPFS",
  });
  const certFile = new File([certBlob], "CERT-BENCH-IPFS.pdf", { type: "application/pdf" });
  const certCycle = await runCycle("certificate-pdf", "certificate-pdf", 1, certFile, false);
  const certUploadedAtMs = performance.now();
  cycles.push(certCycle);
  if (certCycle.ok && certCycle.cid) cleanupQueue.push(certCycle.cid);
  console.log(
    `[bench-ipfs] certificate PDF: ${certCycle.ok ? "uploaded" : "FAILED"} ` +
      `bytes=${certCycle.fileBytes} uploadMs=${certCycle.uploadMs ?? "-"} ` +
      `retrievalMs=${certCycle.retrievalMs ?? "-"} integrity=${certCycle.integrityOk} ` +
      `cid=${certCycle.cid ? `${certCycle.cid.slice(0, 12)}…` : "-"}`,
  );

  // --- Phase B: size sweep ---
  console.log("\n[bench-ipfs] phase B: synthetic size sweep (unique content per run)");
  for (const size of SIZES) {
    for (let run = 1; run <= runsPerSize; run++) {
      const seed = size.bytes * 31 + run;
      const file = makeSyntheticPdf(size.bytes, seed, `bench-${size.label}-r${run}.pdf`);
      process.stdout.write(`[bench-ipfs] ${size.label} run ${run}/${runsPerSize}: `);
      const cycle = await runCycle("size-sweep", size.label, run, file);
      cycles.push(cycle);
      console.log(
        cycle.ok
          ? `upload=${cycle.uploadMs}ms retrieval=${cycle.retrievalMs ?? "FAILED"}ms ` +
              `integrity=${cycle.integrityOk} firstAttempt=${cycle.firstAttemptRetrievalOk} ` +
              `unpin=${cycle.unpinOk} cid=${cycle.cid ? `${cycle.cid.slice(0, 12)}…` : "-"}`
          : `UPLOAD FAILED: ${cycle.error}`,
      );
      await sleep(INTER_CYCLE_PAUSE_MS);
    }
  }

  // --- Phase C: repeated-upload behavior ---
  console.log("\n[bench-ipfs] phase C: repeated uploads (same file twice, then a different file)");
  const dedupFileA1 = makeSyntheticPdf(20 * 1024, 90001, "bench-dedup-A.pdf");
  const dedupFileA2 = makeSyntheticPdf(20 * 1024, 90001, "bench-dedup-A.pdf");
  const dedupFileB = makeSyntheticPdf(20 * 1024, 90002, "bench-dedup-B.pdf");
  const dedup: DedupRecord = {
    uploadSameFile1: { ok: false, cid: null, uploadMs: null, error: null },
    uploadSameFile2: { ok: false, cid: null, uploadMs: null, error: null },
    uploadDifferentFile: { ok: false, cid: null, uploadMs: null, error: null },
    sameFileCidEqual: null,
    differentFileCidEqual: null,
    unpinResults: [],
  };
  try {
    const u1 = await uploadViaApp(dedupFileA1);
    dedup.uploadSameFile1 = { ok: true, cid: u1.cid, uploadMs: round(u1.uploadMs), error: null };
  } catch (err) {
    dedup.uploadSameFile1.error = errorMessage(err);
  }
  try {
    const u2 = await uploadViaApp(dedupFileA2);
    dedup.uploadSameFile2 = { ok: true, cid: u2.cid, uploadMs: round(u2.uploadMs), error: null };
  } catch (err) {
    dedup.uploadSameFile2.error = errorMessage(err);
  }
  try {
    const u3 = await uploadViaApp(dedupFileB);
    dedup.uploadDifferentFile = { ok: true, cid: u3.cid, uploadMs: round(u3.uploadMs), error: null };
  } catch (err) {
    dedup.uploadDifferentFile.error = errorMessage(err);
  }
  if (dedup.uploadSameFile1.cid && dedup.uploadSameFile2.cid) {
    dedup.sameFileCidEqual = dedup.uploadSameFile1.cid === dedup.uploadSameFile2.cid;
  }
  if (dedup.uploadSameFile1.cid && dedup.uploadDifferentFile.cid) {
    dedup.differentFileCidEqual = dedup.uploadSameFile1.cid === dedup.uploadDifferentFile.cid;
  }
  for (const cid of [
    dedup.uploadSameFile1.cid,
    dedup.uploadSameFile2.cid,
    dedup.uploadDifferentFile.cid,
  ]) {
    if (!cid) continue;
    const unpin = await unpinCid(cid);
    dedup.unpinResults.push({ cid, ok: unpin.ok, httpStatus: unpin.httpStatus });
  }
  console.log(
    `[bench-ipfs] dedup: same-file CIDs equal = ${dedup.sameFileCidEqual}, ` +
      `different-file CIDs equal = ${dedup.differentFileCidEqual}`,
  );

  // --- Delayed re-verification of the certificate PDF (phase A) ---
  const delayedRecheck: DelayedRecheckRecord = { performed: false, elapsedSinceUploadMs: null, retrievalMs: null, httpStatus: null, retrievedSha256: null, integrityOk: null, error: null };
  if (certCycle.ok && certCycle.url && certCycle.originalSha256) {
    const elapsed = performance.now() - certUploadedAtMs;
    console.log("\n[bench-ipfs] phase A2: delayed re-retrieval of the certificate PDF");
    const reRetrieval = await retrieveWithAttempts(certCycle.url);
    delayedRecheck.performed = true;
    delayedRecheck.elapsedSinceUploadMs = round(elapsed);
    delayedRecheck.retrievalMs = reRetrieval.retrievalMs;
    delayedRecheck.httpStatus = reRetrieval.attempts[0]?.httpStatus ?? null;
    delayedRecheck.retrievedSha256 = reRetrieval.bytes ? sha256Hex(reRetrieval.bytes) : null;
    delayedRecheck.integrityOk = reRetrieval.bytes
      ? delayedRecheck.retrievedSha256 === certCycle.originalSha256
      : null;
    if (!reRetrieval.bytes) {
      delayedRecheck.error = reRetrieval.attempts.map((a) => a.error ?? "unknown").join("; ");
    }
    console.log(
      `[bench-ipfs] delayed recheck: integrity=${delayedRecheck.integrityOk} ` +
        `elapsed≈${delayedRecheck.elapsedSinceUploadMs}ms retrievalMs=${delayedRecheck.retrievalMs ?? "FAILED"}`,
    );
  }

  // --- Phase D: live error-handling probes (safe; no secret printed) ---
  console.log("\n[bench-ipfs] phase D: error-handling probes");
  const errorProbes: ErrorProbeRecord[] = [];
  const realJwt = process.env["PINATA_JWT"];
  const secretNeedles = [realJwt, INVALID_CREDENTIAL_PROBE_TOKEN].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  const containsSecret = (s: string) => secretNeedles.some((needle) => s.includes(needle));

  // D1: missing credential
  {
    delete process.env["PINATA_JWT"];
    try {
      const result = await uploadCertificateFile(formWithFile(makeSyntheticPdf(1024, 42, "probe-missing-jwt.pdf")));
      const summary = result.ok ? "unexpected success" : result.message;
      errorProbes.push({
        probe: "missing-credential",
        expectedFailure: true,
        behavedAsExpected: !result.ok && summary.includes("not configured"),
        resultSummary: summary,
        secretLeaked: containsSecret(summary),
      });
      console.log(`[bench-ipfs] probe missing-credential: ${result.ok ? "UNEXPECTED SUCCESS" : "rejected safely"}`);
    } finally {
      if (realJwt !== undefined) process.env["PINATA_JWT"] = realJwt;
    }
  }

  // D2: invalid credential (fake token; the real credential is never rotated)
  {
    const result = await pinFileToIpfs(
      INVALID_CREDENTIAL_PROBE_TOKEN,
      makeSyntheticPdf(1024, 43, "probe-invalid-jwt.pdf"),
    );
    const summary = result.ok ? `unexpected success cid=${result.cid}` : result.message;
    errorProbes.push({
      probe: "invalid-credential",
      expectedFailure: true,
      behavedAsExpected:
        !result.ok &&
        (summary === "IPFS upload failed. Please try again later." ||
          summary === "IPFS upload failed due to a network error. Please try again."),
      resultSummary: summary,
      secretLeaked: containsSecret(summary),
    });
    console.log(`[bench-ipfs] probe invalid-credential: ${result.ok ? "UNEXPECTED SUCCESS" : "rejected safely"}`);
  }

  // D3: malformed upload request
  {
    const result = await uploadCertificateFile("not-formdata" as unknown as FormData);
    const summary = result.ok ? "unexpected success" : result.message;
    errorProbes.push({
      probe: "malformed-request",
      expectedFailure: true,
      behavedAsExpected: !result.ok && summary === "Invalid upload request.",
      resultSummary: summary,
      secretLeaked: containsSecret(summary),
    });
    console.log(`[bench-ipfs] probe malformed-request: ${result.ok ? "UNEXPECTED SUCCESS" : "rejected safely"}`);
  }

  // D4: gateway retrieval of an unknown CID (1 attempt, recorded honestly)
  {
    const fakeCidUrl = `${GATEWAY_BASE}/QmBenchProbeUnknownCid00000000000000000000000`;
    const t0 = performance.now();
    let status: number | null = null;
    let err: string | null = null;
    let bodyNonEmpty = false;
    try {
      const res = await fetch(fakeCidUrl, { signal: AbortSignal.timeout(RETRIEVAL_TIMEOUT_MS) });
      status = res.status;
      const body = new Uint8Array(await res.arrayBuffer());
      bodyNonEmpty = body.length > 0;
    } catch (e) {
      err = errorMessage(e);
    }
    const durationMs = round(performance.now() - t0);
    errorProbes.push({
      probe: "gateway-unknown-cid",
      expectedFailure: true,
      behavedAsExpected: status !== 200 || !bodyNonEmpty,
      resultSummary: `httpStatus=${status ?? "network-error"} bodyNonEmpty=${bodyNonEmpty} durationMs=${durationMs}${err ? ` error=${err}` : ""}`,
      secretLeaked: false,
    });
    console.log(`[bench-ipfs] probe gateway-unknown-cid: status=${status ?? "network-error"} (recorded honestly)`);
  }

  // --- Cleanup: unpin any remaining harness pins ---
  for (const cid of cleanupQueue) {
    const unpin = await unpinCid(cid);
    console.log(`[bench-ipfs] cleanup unpin ${cid.slice(0, 12)}…: ${unpin.ok ? "ok" : `failed (status ${unpin.httpStatus})`}`);
  }

  // --- Stats ---
  const sizeSweepCycles = cycles.filter((c) => c.phase === "size-sweep");
  const successfulUploads = cycles.filter((c) => c.ok);

  const uploadMsAll = successfulUploads.map((c) => c.uploadMs).filter((v): v is number => typeof v === "number");
  const retrievalMsAll = successfulUploads
    .map((c) => c.retrievalMs)
    .filter((v): v is number => typeof v === "number");

  const bySize: Record<string, { uploadMs: Stats | null; retrievalMs: Stats | null }> = {};
  for (const size of SIZES) {
    const runs = sizeSweepCycles.filter((c) => c.label === size.label);
    const okRuns = runs.filter((c) => c.ok);
    bySize[size.label] = {
      uploadMs: stats(okRuns.map((c) => c.uploadMs).filter((v): v is number => typeof v === "number")),
      retrievalMs: stats(okRuns.map((c) => c.retrievalMs).filter((v): v is number => typeof v === "number")),
    };
  }

  // --- Reliability (denominators are exact sample counts) ---
  const uploadAttempted = cycles.length + 3; // + 3 dedup uploads
  const uploadSucceeded = successfulUploads.length + [dedup.uploadSameFile1, dedup.uploadSameFile2, dedup.uploadDifferentFile].filter((u) => u.ok).length;
  const retrievalAttempted = successfulUploads.length;
  const retrievalFirstAttemptOk = successfulUploads.filter((c) => c.firstAttemptRetrievalOk).length;
  const retrievalWithRetriesOk = successfulUploads.filter((c) => c.retrievalOk).length;
  const integrityChecked = successfulUploads.filter((c) => c.integrityOk !== null).length;
  const integrityOkCount = successfulUploads.filter((c) => c.integrityOk === true).length;

  const rate = (num: number, den: number): string => (den === 0 ? "n/a" : `${num}/${den} (${round((num / den) * 100)}%)`);

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      harness: "scripts/bench-ipfs.ts",
      runsPerSize,
      sizes: SIZES.map((s) => ({ label: s.label, bytes: s.bytes })),
      totalRealUploadCycles: cycles.length,
      retrievalAttemptsPerCycle: RETRIEVAL_ATTEMPTS,
      gateway: GATEWAY_BASE,
      scopeRationale:
        "Full scope (7 sizes × N runs) chosen because Pinata unpin cleanup (DELETE /pinning/unpin/{cid}) was verified available (HTTP 200) with the server-side credential before the benchmark; every harness pin is unpinned afterwards.",
      timingBoundaries: {
        uploadMs:
          "START: uploadToIPFS(file) invoked via the in-process server-function chain (same convention as bench-issuance ipfsUploadMs — only the browser→server HTTP RPC hop is absent). END: CID + gateway URL returned by the server handler.",
        retrievalMs:
          "START: gateway GET of the app-returned URL issued. END: full body read of a non-empty 2xx response. The first successful attempt's duration is used; failed attempts are recorded per run.",
      },
      integrityProtocol:
        "SHA-256(original uploaded bytes) must equal SHA-256(retrieved bytes). HTTP 200 alone is never treated as success; the body must be non-empty and byte-identical.",
      domainSeparation:
        "documentByteHash (file-byte integrity, measured here) is intentionally separate from metadataFingerprint (certificate registry identity, TASK 1). They are never compared to each other.",
      contentGeneration:
        "Size-sweep files use deterministic mulberry32-seeded synthetic bytes, unique per size+run, so every upload is genuinely new content. No PII is used anywhere.",
      secrets: "PINATA_JWT is read only from the server-side environment and is never printed or written to this file.",
      notes: [
        "All uploads are REAL Pinata pins through the application's own server-side upload path.",
        "All retrievals are REAL gateway GETs of the returned CID.",
        "stdDev is the sample standard deviation (n-1).",
        "Failed runs are recorded honestly and excluded from timing stats (they remain in the raw cycles list and reliability denominators).",
      ],
    },
    cycles,
    certificateDelayedRecheck: delayedRecheck,
    repeatedUploads: dedup,
    errorProbes,
    stats: {
      overall: { uploadMs: stats(uploadMsAll), retrievalMs: stats(retrievalMsAll) },
      bySize,
    },
    reliability: {
      upload: {
        attempted: uploadAttempted,
        succeeded: uploadSucceeded,
        failed: uploadAttempted - uploadSucceeded,
        rate: rate(uploadSucceeded, uploadAttempted),
        note: "attempted = certificate PDF + size-sweep cycles + 3 dedup uploads (all expected-success paths; error probes are excluded because failure is their expected outcome).",
      },
      retrievalFirstAttempt: {
        succeeded: retrievalFirstAttemptOk,
        attempted: retrievalAttempted,
        rate: rate(retrievalFirstAttemptOk, retrievalAttempted),
      },
      retrievalWithRetries: {
        succeeded: retrievalWithRetriesOk,
        attempted: retrievalAttempted,
        rate: rate(retrievalWithRetriesOk, retrievalAttempted),
        note: `up to ${RETRIEVAL_ATTEMPTS} attempts per cycle with ${RETRIEVAL_RETRY_DELAY_MS}ms between attempts`,
      },
      integrity: {
        byteIdentical: integrityOkCount,
        checked: integrityChecked,
        rate: rate(integrityOkCount, integrityChecked),
        note: "checked = successful uploads whose retrieval returned bytes; byteIdentical = SHA-256(original) === SHA-256(retrieved).",
      },
      delayedCertificateRecheck: {
        performed: delayedRecheck.performed,
        integrityOk: delayedRecheck.integrityOk,
      },
      dedup: {
        sameFileCidEqual: dedup.sameFileCidEqual,
        differentFileCidEqual: dedup.differentFileCidEqual,
      },
      errorProbesBehavedAsExpected: `${errorProbes.filter((p) => p.behavedAsExpected).length}/${errorProbes.length}`,
      unpinCleanup: {
        attempted: dedup.unpinResults.length + cleanupQueue.length + sizeSweepCycles.filter((c) => c.unpinOk !== null).length,
        succeeded:
          dedup.unpinResults.filter((u) => u.ok).length +
          sizeSweepCycles.filter((c) => c.unpinOk === true).length,
        note: "certificate-PDF and remaining-queue unpin outcomes are printed to the console; size-sweep and dedup unpin outcomes are stored per record.",
      },
    },
  };

  const outDir = path.join(import.meta.dir, "..", "benchmarks");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "ipfs-results.json");
  writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");

  console.log("\n[bench-ipfs] === SUMMARY ===");
  console.log(`  upload:    ${output.reliability.upload.rate}`);
  console.log(`  retrieval (1st attempt): ${output.reliability.retrievalFirstAttempt.rate}`);
  console.log(`  retrieval (with retries): ${output.reliability.retrievalWithRetries.rate}`);
  console.log(`  integrity: ${output.reliability.integrity.rate}`);
  const o = output.stats.overall;
  if (o.uploadMs) console.log(`  uploadMs:   n=${o.uploadMs.n} min=${o.uploadMs.min} max=${o.uploadMs.max} mean=${o.uploadMs.mean} median=${o.uploadMs.median} stdDev=${o.uploadMs.stdDev}`);
  if (o.retrievalMs) console.log(`  retrievalMs: n=${o.retrievalMs.n} min=${o.retrievalMs.min} max=${o.retrievalMs.max} mean=${o.retrievalMs.mean} median=${o.retrievalMs.median} stdDev=${o.retrievalMs.stdDev}`);
  console.log(`\n[bench-ipfs] raw results written to ${outFile}`);

  const anyFailed = cycles.some((c) => !c.ok) || successfulUploads.some((c) => !c.retrievalOk || c.integrityOk !== true);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("[bench-ipfs] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
