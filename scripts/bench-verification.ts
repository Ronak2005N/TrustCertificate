/**
 * bench-verification.ts — REAL certificate verification pipeline benchmark.
 *
 * Exercises the application's own verification functions against the LIVE
 * Polygon Amoy registry and LIVE Supabase metadata (read-only; sends no
 * transactions, writes nothing):
 *
 *   Method A — verifyCertificate(hash)            [src/lib/certificates.ts]
 *   Method B — QR payload (app's exact format) → hash extraction → verifyCertificate
 *   Method C — analyzeDocument(pdfFile)           [src/lib/certificates.ts]
 *
 * Plus: unknown/malformed inputs, PDF tampering, chain-only certificates,
 * revoked certificates (if any exist), and on-chain vs Supabase vs recomputed
 * fingerprint consistency.
 *
 * Run:
 *   bun scripts/bench-verification.ts
 *
 * Output:
 *   benchmarks/verification-results.json
 *
 * Timing boundaries:
 *   verifyCertificate: START = function invoked. END = promise resolved.
 *   Stage marks come from the function's own onStage(index) callbacks:
 *     stage0 validate = mark1 - call
 *     stage1 provider = mark2 - mark1
 *     stage2 contract = mark3 - mark2
 *     stage3 search+match+supabase+decision = resolve - mark3
 *   analyzeDocument: START = function invoked. END = promise resolved.
 *     stage0 read+byteHash = mark1 - call
 *     stage1 PDF field extraction = mark2 - mark1
 *     stage2 chain+supabase search = mark3 - mark2
 *     stage3 fingerprint compare+decision = resolve - mark3
 *   Method B additionally records QR payload build + hash extraction time
 *   (string operations; the camera-scan step is outside the application).
 *
 * Notes:
 *   - QR format mirrors src/components/certificate/CertificatePreview.tsx:
 *     https://certiproof.app/verify/${hash}; hash extraction mirrors the
 *     /verify_/$hash route param.
 *   - metadataFingerprint (registry key) and documentByteHash (file bytes)
 *     are separate domains and are never compared as equals; the harness
 *     only records whether they differ (expected: differ).
 *   - No PII is written to the output file: only certificate IDs, public
 *     hashes, outcomes and timings.
 *   - Secrets are never printed; the harness reads none.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import {
  analyzeDocument,
  fetchAllCertificatesFromSupabase,
  verifyCertificate,
} from "../src/lib/certificates";
import { generateCertificateFingerprint } from "../src/lib/certificate-fingerprint";
import { generateCertificateBlob } from "../src/lib/pdf/generate-certificate";
import {
  CERT_CHAIN_REGISTRY_ABI,
  CONTRACT_ADDRESS,
  POLYGON_AMOY,
} from "../src/lib/blockchain/contracts";
import type { Certificate } from "../src/lib/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TARGET_RUNS_PER_METHOD = 10;
const UNKNOWN_HASH_RUNS = 5;
const INTER_CALL_PAUSE_MS = 300;
const QR_APP_BASE = "https://certiproof.app/verify";

// ---------------------------------------------------------------------------
// QR helpers — mirror the app's exact format and route-param extraction.
// Exported so unit tests can assert Method B ≡ Method A at the code level.
// ---------------------------------------------------------------------------

export function buildQrPayload(hash: string): string {
  return `${QR_APP_BASE}/${hash}`;
}

export function extractHashFromQrPayload(payload: string): string | null {
  const match = payload.match(/\/verify\/([^/?#]+)/);
  return match?.[1] ?? null;
}

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

interface OnChainEntry {
  id: string;
  hash: string;
  status: number;
  cid: string;
}

interface StageMarks {
  call: number;
  marks: number[];
  resolve: number;
}

interface MethodARun {
  run: number;
  certificateId: string;
  hash: string;
  ok: boolean;
  outcome: string;
  durationMs: number;
  stagesMs: { validate: number | null; provider: number | null; contract: number | null; searchAndDecision: number | null };
  metadataFingerprintCheck: "MATCH" | "MISMATCH" | "absent";
  issuerAuthorization: string | null;
  revocationCheck: string | null;
  blockchainRecordPass: boolean | null;
  confirmationsPass: boolean | null;
  ipfsDocumentPass: boolean | null;
  recipientNameEmpty: boolean | null;
  errorType: string | null;
}

interface MethodBRun {
  run: number;
  certificateId: string;
  hash: string;
  payloadBuildMs: number;
  extractionMs: number;
  extractedHash: string | null;
  verifyDurationMs: number | null;
  totalMs: number | null;
  outcome: string | null;
  methodAOutcome: string | null;
  consistentWithMethodA: boolean | null;
}

interface MethodCRun {
  run: number;
  certificateId: string;
  fileBytes: number;
  ok: boolean;
  outcome: string;
  durationMs: number;
  stagesMs: { readAndByteHash: number | null; extractFields: number | null; registrySearch: number | null; compareAndDecision: number | null };
  documentByteHash: string | null;
  metadataFingerprint: string | null;
  registeredHash: string | null;
  fingerprintMatchesChain: boolean | null;
  domainsSeparated: boolean | null;
  dateFieldMatch: boolean | null;
  errorType: string | null;
}

interface NegativeRecord {
  case: string;
  input: string;
  extractionSucceeded: boolean | null;
  ok: boolean;
  outcome: string | null;
  errorType: string | null;
  durationMs: number;
}

interface TamperRecord {
  case: string;
  targetField: string;
  replacementFound: boolean;
  occurrenceCount: number;
  baselineOutcome: string | null;
  tamperedOutcome: string;
  durationMs: number;
  detectedBySystem: boolean;
}

interface FingerprintConsistencyRecord {
  certificateId: string;
  recomputedEqOnChain: boolean;
  supabaseEqOnChain: boolean;
  allThreeEqual: boolean;
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
  console.error(`[bench-verification] ABORT: ${message}`);
  process.exit(1);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sha256HexBytes(bytes: Uint8Array): string {
  return `0x${createHash("sha256").update(bytes).digest("hex")}`;
}

function deterministicUnknownHash(tag: string): string {
  return `0x${createHash("sha256").update(`certiproof-verification-bench-unknown:${tag}`).digest("hex")}`;
}

/** Timestamps around a verification call, driven by the function's onStage callbacks. */
function stageTracker() {
  const call = performance.now();
  const marks: number[] = [];
  const onStage = (index: number) => {
    marks[index] = performance.now();
  };
  const finish = () => {
    const resolve = performance.now();
    const at = (i: number): number | null => (marks[i] !== undefined ? marks[i]! : null);
    return {
      call,
      resolve,
      m1: at(1),
      m2: at(2),
      m3: at(3),
      durationMs: round(resolve - call),
    };
  };
  return { onStage, finish };
}

/** Replace the FIRST occurrence of `find` inside a latin1 PDF byte image. Same length keeps the PDF structure intact. */
function replaceOnceInPdf(bytes: Uint8Array, find: string, replace: string): { bytes: Uint8Array; found: boolean; occurrences: number } {
  if (find.length !== replace.length) {
    throw new Error("replaceOnceInPdf requires equal-length strings");
  }
  const text = new TextDecoder("latin1").decode(bytes);
  let occurrences = 0;
  let index = text.indexOf(find);
  while (index !== -1) {
    occurrences++;
    index = text.indexOf(find, index + find.length);
  }
  if (occurrences === 0) return { bytes, found: false, occurrences: 0 };
  const replaced = text.replace(find, replace);
  return { bytes: new TextEncoder().encode(replaced), found: true, occurrences };
}

/** Deterministic same-length character mutation of a metadata string. */
function mutateSameLength(value: string): string {
  const chars = [...value];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch !== "Z" && ch !== "z" && ch !== "9") {
      chars[i] = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
      const out = chars.join("");
      if (out !== value) return out;
    }
  }
  if (chars.length === 0) return "X";
  chars[chars.length - 1] = chars[chars.length - 1] === "Z" ? "Y" : "Z";
  return chars.join("");
}

function checksMap(checks: { label: string; value: string; pass: boolean }[]): Map<string, { value: string; pass: boolean }> {
  return new Map(checks.map((c) => [c.label, { value: c.value, pass: c.pass }]));
}

function rate(num: number, den: number): string {
  return den === 0 ? "n/a" : `${num}/${den} (${round((num / den) * 100)}%)`;
}

// ---------------------------------------------------------------------------
// Population discovery (read-only)
// ---------------------------------------------------------------------------

async function enumerateOnChain(): Promise<OnChainEntry[]> {
  const provider = new ethers.JsonRpcProvider(POLYGON_AMOY.rpcUrl);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CERT_CHAIN_REGISTRY_ABI, provider);
  const countFn = contract["getCertificateCount()"];
  const idsFn = contract["certificateIds(uint256)"];
  const getFn = contract["getCertificate(string)"];
  if (!countFn || !idsFn || !getFn) abort("contract ABI missing registry functions");
  // Public RPCs throttle bursts; retry each registry read instead of failing the run.
  const withRetry = async <T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        console.error(`[bench-verification] discovery retry ${i + 1}/${attempts} (${label}): ${errorMessage(err)}`);
        await sleep(1000 * (i + 1));
      }
    }
    throw lastErr;
  };
  const count = Number(await withRetry("getCertificateCount", () => countFn()));
  const entries: OnChainEntry[] = [];
  for (let i = 0; i < count; i++) {
    const id: string = await withRetry(`certificateIds(${i})`, () => idsFn(i));
    const r = await withRetry(`getCertificate(${id})`, () => getFn(id));
    entries.push({
      id,
      hash: String(r[0]).toLowerCase(),
      status: Number(r[5]),
      cid: String(r[2]),
    });
    await sleep(150);
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env["VITE_SUPABASE_URL"] || !process.env["VITE_SUPABASE_ANON_KEY"]) {
    abort("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env");
  }

  console.log("[bench-verification] CertiProof verification benchmark — LIVE read-only (Polygon Amoy + Supabase)");
  console.log("[bench-verification] discovering registry population…");
  const chain = await enumerateOnChain();
  const supabaseRows: Certificate[] = await fetchAllCertificatesFromSupabase();
  const supabaseByHash = new Map(supabaseRows.map((c) => [c.hash.toLowerCase(), c]));
  const supabaseBacked = chain.filter((c) => supabaseByHash.has(c.hash));
  const chainOnly = chain.filter((c) => !supabaseByHash.has(c.hash));
  const revokedOnChain = chain.filter((c) => c.status !== 0);
  const chainHashes = new Set(chain.map((c) => c.hash));

  console.log(
    `[bench-verification] on-chain: ${chain.length} | supabase rows: ${supabaseRows.length} | ` +
      `supabase-backed: ${supabaseBacked.length} | chain-only: ${chainOnly.length} | revoked: ${revokedOnChain.length}`,
  );

  const activeBacked = supabaseBacked.filter((c) => c.status === 0);
  const runsPerMethod = Math.min(TARGET_RUNS_PER_METHOD, activeBacked.length);
  if (runsPerMethod === 0) abort("no active Supabase-backed certificates available for valid-run baselines");

  // ---------------------------------------------------------------- Method A
  console.log(`\n[bench-verification] METHOD A: verifyCertificate(hash) — ${runsPerMethod} runs`);
  const methodARuns: MethodARun[] = [];
  const methodAOutcomeByHash = new Map<string, string>();
  for (let run = 1; run <= runsPerMethod; run++) {
    const target = activeBacked[(run - 1) % activeBacked.length]!;
    const tracker = stageTracker();
    const result = await verifyCertificate(target.hash, tracker.onStage);
    const t = tracker.finish();
    const cm = checksMap(result.checks);
    const meta = cm.get("Metadata Fingerprint");
    const record: MethodARun = {
      run,
      certificateId: target.id,
      hash: target.hash,
      ok: true,
      outcome: result.outcome,
      durationMs: t.durationMs,
      stagesMs: {
        validate: t.m1 !== null ? round(t.m1 - t.call) : null,
        provider: t.m1 !== null && t.m2 !== null ? round(t.m2 - t.m1) : null,
        contract: t.m2 !== null && t.m3 !== null ? round(t.m3 - t.m2) : null,
        searchAndDecision: t.m3 !== null ? round(t.resolve - t.m3) : null,
      },
      metadataFingerprintCheck: meta ? (meta.value === "MATCH" ? "MATCH" : "MISMATCH") : "absent",
      issuerAuthorization: cm.get("Issuer Authorization")?.value ?? null,
      revocationCheck: cm.get("Revocation Status")?.value ?? null,
      blockchainRecordPass: cm.get("Blockchain Record")?.pass ?? null,
      confirmationsPass: cm.get("Confirmations")?.pass ?? null,
      ipfsDocumentPass: cm.get("IPFS Document")?.pass ?? null,
      recipientNameEmpty: result.certificate ? result.certificate.recipientName === "" : null,
      errorType: result.error?.type ?? null,
    };
    methodARuns.push(record);
    methodAOutcomeByHash.set(target.hash, record.outcome);
    console.log(
      `[bench-verification] A run ${run}/${runsPerMethod} ${target.id}: outcome=${record.outcome} ` +
        `ms=${record.durationMs} meta=${record.metadataFingerprintCheck} issuer=${record.issuerAuthorization ?? "-"} ` +
        `chainRecordPass=${record.blockchainRecordPass}`,
    );
    await sleep(INTER_CALL_PAUSE_MS);
  }

  // ---------------------------------------------------------------- Method B
  console.log(`\n[bench-verification] METHOD B: QR payload → extract hash → verifyCertificate — ${runsPerMethod} runs`);
  const methodBRuns: MethodBRun[] = [];
  for (let run = 1; run <= runsPerMethod; run++) {
    const target = activeBacked[(run - 1) % activeBacked.length]!;
    const b0 = performance.now();
    const payload = buildQrPayload(target.hash);
    const b1 = performance.now();
    const extracted = extractHashFromQrPayload(payload);
    const b2 = performance.now();
    let verifyDurationMs: number | null = null;
    let outcome: string | null = null;
    if (extracted !== null) {
      const result = await verifyCertificate(extracted);
      verifyDurationMs = round(performance.now() - b2);
      outcome = result.outcome;
    }
    const total = round(performance.now() - b0);
    const methodAOutcome = methodAOutcomeByHash.get(target.hash) ?? null;
    methodBRuns.push({
      run,
      certificateId: target.id,
      hash: target.hash,
      payloadBuildMs: round(b1 - b0),
      extractionMs: round(b2 - b1),
      extractedHash: extracted,
      verifyDurationMs,
      totalMs: verifyDurationMs !== null ? total : round(b2 - b0),
      outcome,
      methodAOutcome,
      consistentWithMethodA: outcome !== null && methodAOutcome !== null ? outcome === methodAOutcome : null,
    });
    console.log(
      `[bench-verification] B run ${run}/${runsPerMethod} ${target.id}: outcome=${outcome} totalMs=${total} consistentWithA=${methodBRuns[methodBRuns.length - 1]!.consistentWithMethodA}`,
    );
    await sleep(INTER_CALL_PAUSE_MS);
  }

  // ---------------------------------------------------------------- Method C
  console.log(`\n[bench-verification] METHOD C: analyzeDocument(real generated PDF) — ${runsPerMethod} runs`);
  const methodCRuns: MethodCRun[] = [];
  for (let run = 1; run <= runsPerMethod; run++) {
    const target = activeBacked[(run - 1) % activeBacked.length]!;
    const meta = supabaseByHash.get(target.hash)!;
    const blob = await generateCertificateBlob({
      id: meta.id,
      recipientName: meta.recipientName,
      course: meta.course,
      organization: meta.organization,
      issueDate: meta.issueDate,
      certificateNumber: meta.id,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const file = new File([bytes], `${meta.id}.pdf`, { type: "application/pdf" });
    const tracker = stageTracker();
    const result = await analyzeDocument(file, tracker.onStage);
    const t = tracker.finish();
    const dateField = result.fields.find((f) => f.label === "Issue Date");
    const fpMatch =
      result.metadataFingerprint && result.registeredHash
        ? result.metadataFingerprint.toLowerCase() === result.registeredHash.toLowerCase()
        : null;
    methodCRuns.push({
      run,
      certificateId: meta.id,
      fileBytes: bytes.length,
      ok: true,
      outcome: result.outcome,
      durationMs: t.durationMs,
      stagesMs: {
        readAndByteHash: t.m1 !== null ? round(t.m1 - t.call) : null,
        extractFields: t.m1 !== null && t.m2 !== null ? round(t.m2 - t.m1) : null,
        registrySearch: t.m2 !== null && t.m3 !== null ? round(t.m3 - t.m2) : null,
        compareAndDecision: t.m3 !== null ? round(t.resolve - t.m3) : null,
      },
      documentByteHash: result.documentByteHash,
      metadataFingerprint: result.metadataFingerprint ?? null,
      registeredHash: result.registeredHash ?? null,
      fingerprintMatchesChain: fpMatch,
      domainsSeparated:
        result.metadataFingerprint !== null && result.metadataFingerprint !== result.documentByteHash,
      dateFieldMatch: dateField?.match ?? null,
      errorType: null,
    });
    console.log(
      `[bench-verification] C run ${run}/${runsPerMethod} ${meta.id}: outcome=${result.outcome} ` +
        `ms=${t.durationMs} fpMatch=${fpMatch} domainsSeparated=${methodCRuns[methodCRuns.length - 1]!.domainsSeparated}`,
    );
    await sleep(INTER_CALL_PAUSE_MS);
  }

  // -------------------------------------------------------------- Negatives
  console.log("\n[bench-verification] NEGATIVE TESTS");

  // Unknown (well-formed, verified absent from registry) hashes
  const unknownHashNegatives: NegativeRecord[] = [];
  for (let i = 0; i < UNKNOWN_HASH_RUNS; i++) {
    const hash = deterministicUnknownHash(String(i));
    if (chainHashes.has(hash)) continue; // astronomically unlikely; skip honestly
    const tracker = stageTracker();
    const result = await verifyCertificate(hash, tracker.onStage);
    const t = tracker.finish();
    unknownHashNegatives.push({
      case: `unknown-hash-${i}`,
      input: hash,
      extractionSucceeded: null,
      ok: true,
      outcome: result.outcome,
      errorType: result.error?.type ?? null,
      durationMs: t.durationMs,
    });
    console.log(`[bench-verification] unknown hash ${i}: outcome=${result.outcome} ms=${t.durationMs}`);
    await sleep(INTER_CALL_PAUSE_MS);
  }

  // Malformed hashes (rejected locally before any RPC)
  const malformedHashNegatives: NegativeRecord[] = [];
  for (const [label, value] of [
    ["empty", ""],
    ["short-0x", "0x123"],
    ["no-prefix", "deadbeef".repeat(8)],
    ["non-hex", `0x${"zz".repeat(32)}`],
  ] as const) {
    const tracker = stageTracker();
    const result = await verifyCertificate(value, tracker.onStage);
    const t = tracker.finish();
    malformedHashNegatives.push({
      case: `malformed-hash-${label}`,
      input: value === "" ? "(empty string)" : value.length > 20 ? `${value.slice(0, 20)}…(${value.length} chars)` : value,
      extractionSucceeded: null,
      ok: true,
      outcome: result.outcome,
      errorType: result.error?.type ?? null,
      durationMs: t.durationMs,
    });
    console.log(`[bench-verification] malformed hash (${label}): outcome=${result.outcome} type=${result.error?.type ?? "-"} ms=${t.durationMs}`);
  }

  // Malformed QR payloads
  const malformedQrNegatives: NegativeRecord[] = [];
  for (const [label, payload] of [
    ["garbage", "not-a-qr-payload-at-all"],
    ["url-no-hash", `${QR_APP_BASE}/`],
    ["url-bad-hash", `${QR_APP_BASE}/0xZZZ`],
    ["foreign-url", "https://example.com/something"],
  ] as const) {
    const e0 = performance.now();
    const extracted = extractHashFromQrPayload(payload);
    const extractionMs = round(performance.now() - e0);
    if (extracted === null) {
      malformedQrNegatives.push({
        case: `malformed-qr-${label}`,
        input: payload,
        extractionSucceeded: false,
        ok: true,
        outcome: "malformed_payload_no_hash_extracted",
        errorType: null,
        durationMs: extractionMs,
      });
      console.log(`[bench-verification] malformed QR (${label}): no hash extracted (extraction ${extractionMs}ms)`);
    } else {
      const result = await verifyCertificate(extracted);
      malformedQrNegatives.push({
        case: `malformed-qr-${label}`,
        input: payload,
        extractionSucceeded: true,
        ok: true,
        outcome: result.outcome,
        errorType: result.error?.type ?? null,
        durationMs: extractionMs,
      });
      console.log(`[bench-verification] malformed QR (${label}): extracted "${extracted.slice(0, 12)}…" → outcome=${result.outcome}`);
      await sleep(INTER_CALL_PAUSE_MS);
    }
  }

  // QR with unknown-but-well-formed hash (payload build + extraction + verification timed together)
  const unknownQrNegatives: NegativeRecord[] = [];
  for (let i = 0; i < 2; i++) {
    const hash = deterministicUnknownHash(`qr-${i}`);
    if (chainHashes.has(hash)) continue;
    const t0 = performance.now();
    const payload = buildQrPayload(hash);
    const extracted = extractHashFromQrPayload(payload);
    const result = await verifyCertificate(extracted ?? hash);
    unknownQrNegatives.push({
      case: `unknown-qr-hash-${i}`,
      input: `${QR_APP_BASE}/<unknown-hash-${i}>`,
      extractionSucceeded: extracted !== null,
      ok: true,
      outcome: result.outcome,
      errorType: result.error?.type ?? null,
      durationMs: round(performance.now() - t0),
    });
    console.log(`[bench-verification] unknown QR hash ${i}: outcome=${result.outcome}`);
    await sleep(INTER_CALL_PAUSE_MS);
  }

  // ------------------------------------------------------- PDF tamper tests
  console.log("\n[bench-verification] TAMPER TESTS (copies only; originals untouched)");
  const tamperTarget = activeBacked[0]!;
  const tamperMeta = supabaseByHash.get(tamperTarget.hash)!;
  const baseBlob = await generateCertificateBlob({
    id: tamperMeta.id,
    recipientName: tamperMeta.recipientName,
    course: tamperMeta.course,
    organization: tamperMeta.organization,
    issueDate: tamperMeta.issueDate,
    certificateNumber: tamperMeta.id,
  });
  const baseBytes = new Uint8Array(await baseBlob.arrayBuffer());
  const baseFile = new File([baseBytes], `${tamperMeta.id}.pdf`, { type: "application/pdf" });
  const baseline = await analyzeDocument(baseFile);
  console.log(`[bench-verification] tamper baseline ${tamperMeta.id}: outcome=${baseline.outcome}`);

  const tamperRecords: TamperRecord[] = [];
  const tamperPlan: Array<{ caseName: string; field: string; find: string; replace: string }> = [];

  const isoDate = tamperMeta.issueDate.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const day = Number(isoDate.slice(8));
    const shifted = `${isoDate.slice(0, 8)}${String(day === 1 ? 2 : day - 1).padStart(2, "0")}`;
    tamperPlan.push({ caseName: "tamper-issue-date", field: "issueDate", find: isoDate, replace: shifted });
  }
  if (tamperMeta.recipientName.length > 0) {
    tamperPlan.push({
      caseName: "tamper-recipient-name",
      field: "recipientName",
      find: tamperMeta.recipientName,
      replace: mutateSameLength(tamperMeta.recipientName),
    });
  }
  if (tamperMeta.course.length > 0) {
    tamperPlan.push({
      caseName: "tamper-course",
      field: "course",
      find: tamperMeta.course,
      replace: mutateSameLength(tamperMeta.course),
    });
  }
  {
    const id = tamperMeta.id;
    const digits = id.match(/(\d+)$/)?.[1] ?? "999999";
    const fakeId = `CERT-2099-${"9".repeat(digits.length)}`;
    if (fakeId.length === id.length && fakeId !== id) {
      tamperPlan.push({ caseName: "tamper-certificate-id", field: "certificateId", find: id, replace: fakeId });
    }
  }

  for (const plan of tamperPlan) {
    const replaced = replaceOnceInPdf(baseBytes, plan.find, plan.replace);
    if (!replaced.found) {
      tamperRecords.push({
        case: plan.caseName,
        targetField: plan.field,
        replacementFound: false,
        occurrenceCount: 0,
        baselineOutcome: baseline.outcome,
        tamperedOutcome: "not_run_replacement_not_found",
        durationMs: 0,
        detectedBySystem: false,
      });
      console.log(`[bench-verification] ${plan.caseName}: source string NOT found in PDF bytes — replacement impossible`);
      continue;
    }
    const file = new File([replaced.bytes], `${tamperMeta.id}-tampered.pdf`, { type: "application/pdf" });
    const t0 = performance.now();
    const result = await analyzeDocument(file);
    const durationMs = round(performance.now() - t0);
    tamperRecords.push({
      case: plan.caseName,
      targetField: plan.field,
      replacementFound: true,
      occurrenceCount: replaced.occurrences,
      baselineOutcome: baseline.outcome,
      tamperedOutcome: result.outcome,
      durationMs,
      detectedBySystem: result.outcome !== "match",
    });
    console.log(
      `[bench-verification] ${plan.caseName}: baseline=${baseline.outcome} tampered=${result.outcome} ` +
        `detected=${result.outcome !== "match"} occurrences=${replaced.occurrences} ms=${durationMs}`,
    );
    await sleep(INTER_CALL_PAUSE_MS);
  }

  // Garbage / unsupported documents
  console.error("[bench-verification] MARKER: entering garbage section");
  const garbageInputs: NegativeRecord[] = [];
  const garbagePlan: Array<{ case: string; file: File }> = [
    { case: "text-file-renamed-pdf", file: new File(["This is not a certificate document."], "fake.pdf", { type: "application/pdf" }) },
    { case: "png-image", file: new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])], "scan.png", { type: "image/png" }) },
    { case: "empty-file", file: new File([], "empty.pdf", { type: "application/pdf" }) },
  ];
  for (const g of garbagePlan) {
    const t0 = performance.now();
    const result = await analyzeDocument(g.file);
    garbageInputs.push({
      case: g.case,
      input: `${g.file.name} (${g.file.size} bytes)`,
      extractionSucceeded: null,
      ok: true,
      outcome: result.outcome,
      errorType: null,
      durationMs: round(performance.now() - t0),
    });
    console.log(`[bench-verification] garbage input (${g.case}): outcome=${result.outcome}`);
  }

  // ------------------------------------------------------ Chain-only certs
  console.error("[bench-verification] MARKER: entering chain-only section");
  console.log("\n[bench-verification] CHAIN-ONLY CERTIFICATES (blockchain record, no Supabase row)");
  let chainOnlyMethodA: MethodARun | null = null;
  let chainOnlyMethodC: {
    certificateId: string;
    outcome: string;
    metadataUnavailableIndicated: boolean;
    durationMs: number;
  } | null = null;
  let chainOnlyTarget: { id: string; idFormat: string } | null = null;
  if (chainOnly.length > 0) {
    // Prefer a chain-only cert with the issuance ID format (CERT-YYYY-NNNNNN):
    // synthetic fixtures like CERT-2026-TEST1 are unparseable by Method C's
    // PDF ID extractor, which would make the Method C measurement degenerate.
    const idPattern = /^CERT-\d{4}-\d{4,6}$/;
    const target = chainOnly.find((c) => idPattern.test(c.id)) ?? chainOnly[0]!;
    chainOnlyTarget = { id: target.id, idFormat: idPattern.test(target.id) ? "numeric" : "synthetic" };
    const tracker = stageTracker();
    const result = await verifyCertificate(target.hash, tracker.onStage);
    const t = tracker.finish();
    const cm = checksMap(result.checks);
    chainOnlyMethodA = {
      run: 1,
      certificateId: target.id,
      hash: target.hash,
      ok: true,
      outcome: result.outcome,
      durationMs: t.durationMs,
      stagesMs: {
        validate: t.m1 !== null ? round(t.m1 - t.call) : null,
        provider: t.m1 !== null && t.m2 !== null ? round(t.m2 - t.m1) : null,
        contract: t.m2 !== null && t.m3 !== null ? round(t.m3 - t.m2) : null,
        searchAndDecision: t.m3 !== null ? round(t.resolve - t.m3) : null,
      },
      metadataFingerprintCheck: cm.get("Metadata Fingerprint") ? "MATCH" : "absent",
      issuerAuthorization: cm.get("Issuer Authorization")?.value ?? null,
      revocationCheck: cm.get("Revocation Status")?.value ?? null,
      blockchainRecordPass: cm.get("Blockchain Record")?.pass ?? null,
      confirmationsPass: cm.get("Confirmations")?.pass ?? null,
      ipfsDocumentPass: cm.get("IPFS Document")?.pass ?? null,
      recipientNameEmpty: result.certificate ? result.certificate.recipientName === "" : null,
      errorType: result.error?.type ?? null,
    };
    console.log(`[bench-verification] chain-only Method A ${target.id}: outcome=${chainOnlyMethodA.outcome} meta=${chainOnlyMethodA.metadataFingerprintCheck}`);

    const blob = await generateCertificateBlob({
      id: target.id,
      recipientName: "Chain Only Benchmark",
      course: "Chain Only Course",
      organization: "CertiProof Benchmark Harness",
      issueDate: new Date().toISOString().slice(0, 10),
      certificateNumber: target.id,
    });
    const file = new File([new Uint8Array(await blob.arrayBuffer())], `${target.id}.pdf`, { type: "application/pdf" });
    const t0 = performance.now();
    const docResult = await analyzeDocument(file);
    chainOnlyMethodC = {
      certificateId: target.id,
      outcome: docResult.outcome,
      metadataUnavailableIndicated: docResult.fields.some((f) => f.document.includes("metadata unavailable")),
      durationMs: round(performance.now() - t0),
    };
    console.log(
      `[bench-verification] chain-only Method C ${target.id}: outcome=${chainOnlyMethodC.outcome} ` +
        `metadataUnavailableIndicated=${chainOnlyMethodC.metadataUnavailableIndicated}`,
    );
  } else {
    console.log("[bench-verification] no chain-only certificates present — skipped");
  }

  // -------------------------------------------------------- Revoked certs
  console.error("[bench-verification] MARKER: entering revoked section");
  console.log("\n[bench-verification] REVOKED CERTIFICATES");
  let revokedTests: {
    performed: boolean;
    reason?: string;
    methodA?: { outcome: string; revocationCheck: string | null; durationMs: number };
    methodB?: { outcome: string; durationMs: number };
    methodC?: { outcome: string; certificateStatus: string | null; durationMs: number } | "no_supabase_row";
  } = { performed: false };
  if (revokedOnChain.length > 0) {
    const target = revokedOnChain[0]!;
    const tracker = stageTracker();
    const resultA = await verifyCertificate(target.hash, tracker.onStage);
    const tA = tracker.finish();
    const revCheck = checksMap(resultA.checks).get("Revocation Status")?.value ?? null;

    await sleep(INTER_CALL_PAUSE_MS);
    const t0 = performance.now();
    const extracted = extractHashFromQrPayload(buildQrPayload(target.hash));
    const resultB = await verifyCertificate(extracted ?? target.hash);
    const tB = round(performance.now() - t0);

    let methodC: revokedTests.methodC;
    const supabaseRow = supabaseByHash.get(target.hash);
    if (!supabaseRow) {
      methodC = "no_supabase_row";
    } else {
      await sleep(INTER_CALL_PAUSE_MS);
      const blob = await generateCertificateBlob({
        id: supabaseRow.id,
        recipientName: supabaseRow.recipientName,
        course: supabaseRow.course,
        organization: supabaseRow.organization,
        issueDate: supabaseRow.issueDate,
        certificateNumber: supabaseRow.id,
      });
      const file = new File([new Uint8Array(await blob.arrayBuffer())], `${supabaseRow.id}.pdf`, { type: "application/pdf" });
      const tC0 = performance.now();
      const resultC = await analyzeDocument(file);
      methodC = {
        outcome: resultC.outcome,
        certificateStatus: resultC.certificate?.status ?? null,
        durationMs: round(performance.now() - tC0),
      };
    }

    revokedTests = {
      performed: true,
      methodA: { outcome: resultA.outcome, revocationCheck: revCheck, durationMs: tA.durationMs },
      methodB: { outcome: resultB.outcome, durationMs: tB },
      methodC,
    };
    console.log(
      `[bench-verification] revoked ${target.id}: A=${resultA.outcome} (${revCheck}) B=${resultB.outcome} ` +
        `C=${typeof methodC === "string" ? methodC : `${methodC.outcome} status=${methodC.certificateStatus}`}`,
    );
  } else {
    revokedTests = { performed: false, reason: "no revoked certificates exist on-chain" };
    console.log("[bench-verification] no revoked certificates on-chain — test cannot be performed (recorded honestly)");
  }

  // -------------------------------------------- Fingerprint consistency
  console.error("[bench-verification] MARKER: entering fingerprint-consistency section");
  console.log("\n[bench-verification] FINGERPRINT CONSISTENCY (recomputed vs on-chain vs Supabase)");
  const consistency: FingerprintConsistencyRecord[] = [];
  for (const entry of supabaseBacked) {
    const row = supabaseByHash.get(entry.hash)!;
    const recomputed = (
      await generateCertificateFingerprint({
        certificateId: row.id,
        recipientName: row.recipientName,
        course: row.course,
        issueDate: row.issueDate,
      })
    ).toLowerCase();
    const recomputedEqOnChain = recomputed === entry.hash;
    const supabaseEqOnChain = row.hash.toLowerCase() === entry.hash;
    consistency.push({
      certificateId: row.id,
      recomputedEqOnChain,
      supabaseEqOnChain,
      allThreeEqual: recomputedEqOnChain && supabaseEqOnChain,
    });
  }
  const allEqualCount = consistency.filter((c) => c.allThreeEqual).length;
  console.log(`[bench-verification] all-three-equal: ${allEqualCount}/${consistency.length}`);

  // ------------------------------------------------------ Security check
  console.error("[bench-verification] MARKER: entering security section");
  const securityFiles = [
    "src/lib/certificates.ts",
    "src/lib/certificate-fingerprint.ts",
    "src/lib/crypto.ts",
    "src/lib/supabase.ts",
    "src/lib/blockchain/metamask.ts",
    "src/lib/blockchain/contracts.ts",
  ];
  const secretPatterns = ["PINATA_JWT", "DEPLOYER_PRIVATE_KEY", "service_role", "pinata.cloud", "PRIVATE_KEY"];
  const securityFindings: Array<{ file: string; pattern: string }> = [];
  for (const rel of securityFiles) {
    const content = readFileSync(path.join(import.meta.dir, "..", rel), "utf8");
    for (const pattern of secretPatterns) {
      if (content.includes(pattern)) securityFindings.push({ file: rel, pattern });
    }
  }
  console.log(`[bench-verification] security static scan: ${securityFindings.length} findings in verification-path modules`);

  // -------------------------------------------------------------- Stats
  console.error("[bench-verification] MARKER: entering stats/json section");
  const methodAStats = stats(methodARuns.map((r) => r.durationMs));
  const methodBStats = stats(methodBRuns.map((r) => r.totalMs).filter((v): v is number => typeof v === "number"));
  const methodCStats = stats(methodCRuns.map((r) => r.durationMs));
  const stageStatsFor = (
    runs: Array<{ stagesMs: Record<string, number | null> }>,
  ): Record<string, Stats | null> => {
    const keys = ["validate", "provider", "contract", "searchAndDecision", "readAndByteHash", "extractFields", "registrySearch", "compareAndDecision"];
    const out: Record<string, Stats | null> = {};
    for (const key of keys) {
      const values = runs
        .map((r) => r.stagesMs[key])
        .filter((v): v is number => typeof v === "number");
      if (values.length > 0) out[key] = stats(values);
    }
    return out;
  };

  const aVerified = methodARuns.filter((r) => r.outcome === "verified").length;
  const bConsistent = methodBRuns.filter((r) => r.consistentWithMethodA === true).length;
  const cMatch = methodCRuns.filter((r) => r.outcome === "match").length;
  const unknownNotFound = unknownHashNegatives.filter((r) => r.outcome === "not_found").length;
  const malformedRejected = malformedHashNegatives.filter((r) => r.errorType === "invalid_hash").length;
  const tamperDetected = tamperRecords.filter((r) => r.detectedBySystem).length;
  const tamperRan = tamperRecords.filter((r) => r.tamperedOutcome !== "not_run_replacement_not_found").length;

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      harness: "scripts/bench-verification.ts",
      network: "Polygon Amoy TESTNET (read-only)",
      contractAddress: CONTRACT_ADDRESS,
      rpcUrl: POLYGON_AMOY.rpcUrl,
      targetRunsPerMethod: TARGET_RUNS_PER_METHOD,
      runsPerMethodExecuted: runsPerMethod,
      methods: {
        A: "verifyCertificate(hash) — isHashLike → read-only provider → linear registry scan (getCertificateCount + certificateIds(i) + getCertificate(id) per entry) → on match: getLogs(CertificateRegistered, fromBlock 0) + isAuthorizedIssuer + getBlockNumber → Supabase by-hash metadata → optional fingerprint recompute → checks → outcome",
        B: `QR payload "${QR_APP_BASE}/<hash>" (CertificatePreview format) → last-path-segment extraction (mirrors /verify_/$hash route param) → verifyCertificate. Camera decoding happens on the phone, outside the app.`,
        C: "analyzeDocument(file) — SHA-256 file bytes (reference only) → latin1 raw-text regex extraction of CERT-YYYY-NNNNNN + date → fetchCertificateFromChain(id) + fetchCertificateFromSupabase(id) → recompute fingerprint from Supabase metadata vs chain hash + extracted date vs registry date → outcome",
      },
      timingBoundaries: {
        verifyCertificate:
          "START function invoked, END promise resolved. Stages from onStage marks: validate, provider, contract, searchAndDecision (linear scan + match follow-ups + Supabase + decision).",
        analyzeDocument:
          "START function invoked, END promise resolved. Stages: readAndByteHash, extractFields, registrySearch (chain+Supabase), compareAndDecision.",
        methodBtotal: "payload build + hash extraction + verifyCertificate (camera scan excluded — outside the application).",
      },
      notes: [
        "READ-ONLY: no transactions sent, nothing written to chain or Supabase.",
        "Population discovered live at runtime; runs adapt to available certificates.",
        "documentByteHash and metadataFingerprint are separate domains and are never compared as equals.",
        "No PII written to this file: certificate IDs, public hashes and timings only.",
        "stdDev is the sample standard deviation (n-1). Failed/edge runs are recorded, not discarded.",
        "Public RPC (publicnode) is shared infrastructure; timings include real network variance.",
      ],
    },
    population: {
      onChainTotal: chain.length,
      supabaseRows: supabaseRows.length,
      supabaseBacked: supabaseBacked.length,
      chainOnly: chainOnly.length,
      revokedOnChain: revokedOnChain.length,
      activeSupabaseBackedUsedForValidRuns: activeBacked.length,
    },
    methodA: { runs: methodARuns, stats: methodAStats, stageStats: stageStatsFor(methodARuns) },
    methodB: {
      runs: methodBRuns,
      stats: methodBStats,
      consistencyVsMethodA: rate(bConsistent, methodBRuns.filter((r) => r.consistentWithMethodA !== null).length),
    },
    methodC: { runs: methodCRuns, stats: methodCStats, stageStats: stageStatsFor(methodCRuns) },
    negatives: {
      unknownHash: unknownHashNegatives,
      malformedHash: malformedHashNegatives,
      malformedQr: malformedQrNegatives,
      unknownQr: unknownQrNegatives,
      tamper: tamperRecords,
      garbageInputs,
    },
    chainOnly: { target: chainOnlyTarget, methodA: chainOnlyMethodA, methodC: chainOnlyMethodC },
    revoked: revokedTests,
    fingerprintConsistency: {
      checked: consistency.length,
      allThreeEqual: allEqualCount,
      recomputedEqOnChain: consistency.filter((c) => c.recomputedEqOnChain).length,
      supabaseEqOnChain: consistency.filter((c) => c.supabaseEqOnChain).length,
      mismatches: consistency.filter((c) => !c.allThreeEqual),
    },
    security: {
      staticScanFiles: securityFiles,
      patternsScanned: secretPatterns,
      findings: securityFindings,
    },
    reliability: {
      methodAValidVerified: rate(aVerified, methodARuns.length),
      methodBConsistentWithA: rate(bConsistent, methodBRuns.filter((r) => r.consistentWithMethodA !== null).length),
      methodCValidMatch: rate(cMatch, methodCRuns.length),
      unknownHashDetectedNotFound: rate(unknownNotFound, unknownHashNegatives.length),
      malformedHashRejected: rate(malformedRejected, malformedHashNegatives.length),
      tamperDetected: rate(tamperDetected, tamperRan),
      fingerprintConsistencyAllThree: rate(allEqualCount, consistency.length),
      note: "Each rate states its exact numerator/denominator; denominators are the executed test cases recorded in this file.",
    },
  };

  const outDir = path.join(import.meta.dir, "..", "benchmarks");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "verification-results.json");
  writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");
  console.error(`[bench-verification] MARKER: JSON written to ${outFile}`);

  console.log("\n[bench-verification] === SUMMARY ===");
  console.log(`  Method A verified: ${output.reliability.methodAValidVerified}`);
  console.log(`  Method B consistent with A: ${output.reliability.methodBConsistentWithA}`);
  console.log(`  Method C match: ${output.reliability.methodCValidMatch}`);
  console.log(`  unknown hash → not_found: ${output.reliability.unknownHashDetectedNotFound}`);
  console.log(`  malformed hash → invalid_hash: ${output.reliability.malformedHashRejected}`);
  console.log(`  tamper detected: ${output.reliability.tamperDetected}`);
  console.log(`  fingerprint all-three-equal: ${output.reliability.fingerprintConsistencyAllThree}`);
  if (methodAStats) console.log(`  A ms: n=${methodAStats.n} min=${methodAStats.min} max=${methodAStats.max} mean=${methodAStats.mean} median=${methodAStats.median} stdDev=${methodAStats.stdDev}`);
  if (methodBStats) console.log(`  B ms: n=${methodBStats.n} min=${methodBStats.min} max=${methodBStats.max} mean=${methodBStats.mean} median=${methodBStats.median} stdDev=${methodBStats.stdDev}`);
  if (methodCStats) console.log(`  C ms: n=${methodCStats.n} min=${methodCStats.min} max=${methodCStats.max} mean=${methodCStats.mean} median=${methodCStats.median} stdDev=${methodCStats.stdDev}`);
  console.log(`\n[bench-verification] raw results written to ${outFile}`);
}

if (import.meta.main) {
  // Keep-alive guard: a pending main() promise alone does not hold the event
  // loop open. If any awaited chain dangles without a backing timer, bun would
  // exit 0 silently — this interval prevents that; it is cleared on exit.
  const keepAlive = setInterval(() => {}, 1000);
  const stopKeepAlive = () => clearInterval(keepAlive);
  process.on("uncaughtException", (err) => {
    stopKeepAlive();
    console.error("[bench-verification] UNCAUGHT:", err);
    process.exit(2);
  });
  process.on("unhandledRejection", (err) => {
    stopKeepAlive();
    console.error("[bench-verification] UNHANDLED REJECTION:", err);
    process.exit(3);
  });
  process.on("exit", (code) => {
    stopKeepAlive();
    console.error(`[bench-verification] process exiting with code ${code}`);
  });
  main()
    .then(() => {
      stopKeepAlive();
      console.error("[bench-verification] MARKER: main() completed");
    })
    .catch((err) => {
      stopKeepAlive();
      console.error("[bench-verification] fatal:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
