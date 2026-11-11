import { describe, expect, test } from "bun:test";
import {
  isSupabaseMetadataConsistentWithChain,
  reconcileSupabaseRowsWithChain,
  type ChainLookupResult,
} from "../src/lib/certificates";
import { generateCertificateFingerprint } from "../src/lib/certificate-fingerprint";
import type { Certificate } from "../src/lib/types";

/**
 * Supabase ↔ blockchain integrity boundary tests (Task 9). All offline: the
 * metadata-consistency check is pure SHA-256, and reconciliation receives an
 * injected lookup stub instead of the network. Actual RLS policies live in
 * the Supabase database and cannot be tested from this repository.
 */

const BASE: Certificate = {
  id: "CERT-2026-123456",
  recipientName: "Ada Lovelace",
  recipientEmail: "ada@example.com",
  course: "Blockchain Fundamentals",
  type: "Completion",
  organization: "CertiProof Institute",
  issueDate: "2026-05-18",
  hash: `0x${"a".repeat(64)}`,
  status: "active",
  chain: {
    network: "Polygon Amoy",
    chainId: 80002,
    contract: "0x0000000000000000000000000000000000000000",
    issuerWallet: "0x0000000000000000000000000000000000000001",
    transactionHash: `0x${"1".repeat(64)}`,
    block: 12345,
    confirmedAt: "2026-05-18T00:00:00.000Z",
  },
};

function cert(overrides: Partial<Certificate> = {}): Certificate {
  return { ...BASE, ...overrides, chain: { ...BASE.chain, ...overrides.chain } };
}

async function baseFingerprint(): Promise<string> {
  return generateCertificateFingerprint({
    certificateId: BASE.id,
    recipientName: BASE.recipientName,
    course: BASE.course,
    issueDate: BASE.issueDate,
  });
}

describe("isSupabaseMetadataConsistentWithChain", () => {
  test("untampered metadata matches its own on-chain fingerprint", async () => {
    expect(await isSupabaseMetadataConsistentWithChain(BASE, await baseFingerprint())).toBe(true);
  });

  test("fingerprint comparison is case-insensitive", async () => {
    expect(await isSupabaseMetadataConsistentWithChain(BASE, (await baseFingerprint()).toUpperCase())).toBe(true);
  });

  test("tampered recipient name no longer matches the on-chain anchor", async () => {
    const poisoned = cert({ recipientName: "Wrong Person" });
    expect(await isSupabaseMetadataConsistentWithChain(poisoned, await baseFingerprint())).toBe(false);
  });

  test("tampered course no longer matches the on-chain anchor", async () => {
    const poisoned = cert({ course: "Wrong Course" });
    expect(await isSupabaseMetadataConsistentWithChain(poisoned, await baseFingerprint())).toBe(false);
  });

  test("tampered issue date no longer matches the on-chain anchor", async () => {
    const poisoned = cert({ issueDate: "2099-01-01" });
    expect(await isSupabaseMetadataConsistentWithChain(poisoned, await baseFingerprint())).toBe(false);
  });

  test("row re-keyed to a different certificate id no longer matches the on-chain anchor", async () => {
    const poisoned = cert({ id: "CERT-2026-999999" });
    expect(await isSupabaseMetadataConsistentWithChain(poisoned, await baseFingerprint())).toBe(false);
  });

  test("a fingerprint belonging to a different certificate does not match", async () => {
    const other = await generateCertificateFingerprint({
      certificateId: "CERT-2026-654321",
      recipientName: BASE.recipientName,
      course: BASE.course,
      issueDate: BASE.issueDate,
    });
    expect(await isSupabaseMetadataConsistentWithChain(BASE, other)).toBe(false);
  });
});

describe("reconcileSupabaseRowsWithChain", () => {
  const found = (hash: string, status: "active" | "revoked") =>
    async (_certId: string): Promise<ChainLookupResult> => ({ state: "found", record: { hash, status } });
  const missing = async (_certId: string): Promise<ChainLookupResult> => ({ state: "missing" });
  const error = async (_certId: string): Promise<ChainLookupResult> => ({ state: "error" });

  test("matching row is kept and the on-chain status overrides the client-supplied one", async () => {
    const rows = [cert({ status: "active" })];
    const out = await reconcileSupabaseRowsWithChain(rows, found(BASE.hash, "revoked"));
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe("revoked");
    expect(out[0]!.hash).toBe(BASE.hash);
  });

  test("row whose certificate_hash does not match the on-chain record is dropped", async () => {
    const poisoned = cert({ hash: `0x${"b".repeat(64)}` });
    const out = await reconcileSupabaseRowsWithChain([poisoned], found(BASE.hash, "active"));
    expect(out).toHaveLength(0);
  });

  test("hash comparison is case-insensitive (stored lowercase, chain checksummed)", async () => {
    const rows = [cert({ hash: BASE.hash.toLowerCase() })];
    const out = await reconcileSupabaseRowsWithChain(rows, found(BASE.hash.toUpperCase(), "active"));
    expect(out).toHaveLength(1);
  });

  test("metadata-only row without an on-chain record is dropped", async () => {
    const out = await reconcileSupabaseRowsWithChain([cert()], missing);
    expect(out).toHaveLength(0);
  });

  test("inconclusive lookup (RPC error) keeps the row unchanged — availability over strictness", async () => {
    const rows = [cert({ status: "active" })];
    const out = await reconcileSupabaseRowsWithChain(rows, error);
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe("active");
  });

  test("mixed batch: only chain-anchored rows survive, each with chain status", async () => {
    const valid = cert({ id: "CERT-2026-111111", hash: `0x${"c".repeat(64)}`, status: "active" });
    const wrongHash = cert({ id: "CERT-2026-222222", hash: `0x${"d".repeat(64)}` });
    const notOnChain = cert({ id: "CERT-2026-333333", hash: `0x${"e".repeat(64)}` });
    const out = await reconcileSupabaseRowsWithChain([valid, wrongHash, notOnChain], async (id) => {
      if (id === valid.id) return { state: "found", record: { hash: valid.hash, status: "revoked" } };
      if (id === wrongHash.id) return { state: "found", record: { hash: `0x${"f".repeat(64)}`, status: "active" } };
      return { state: "missing" };
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(valid.id);
    expect(out[0]!.status).toBe("revoked");
  });

  test("empty input produces empty output", async () => {
    expect(await reconcileSupabaseRowsWithChain([], found(BASE.hash, "active"))).toHaveLength(0);
  });
});
