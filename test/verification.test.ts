import { describe, expect, test } from "bun:test";
import { analyzeDocument, verifyCertificate, isHashLike } from "../src/lib/certificates";
import {
  buildQrPayload,
  extractHashFromQrPayload,
} from "../scripts/bench-verification";

/**
 * Offline verification-pipeline tests. Every case below resolves BEFORE any
 * network call (format validation or missing-certificate-ID early return),
 * so these run deterministically without RPC or Supabase access.
 */

describe("verifyCertificate input validation (offline)", () => {
  test("empty hash is rejected as invalid_hash without any network access", async () => {
    const result = await verifyCertificate("");
    expect(result.outcome).toBe("error");
    expect(result.error?.type).toBe("invalid_hash");
  });

  test("short 0x hash is rejected as invalid_hash", async () => {
    const result = await verifyCertificate("0x123");
    expect(result.outcome).toBe("error");
    expect(result.error?.type).toBe("invalid_hash");
  });

  test("non-hex 64-char payload is rejected as invalid_hash", async () => {
    const result = await verifyCertificate(`0x${"zz".repeat(32)}`);
    expect(result.outcome).toBe("error");
    expect(result.error?.type).toBe("invalid_hash");
  });

  test("isHashLike matches exactly 0x + 64 hex characters", () => {
    expect(isHashLike(`0x${"a".repeat(64)}`)).toBe(true);
    expect(isHashLike(`0x${"A".repeat(64)}`)).toBe(true);
    expect(isHashLike(`0x${"a".repeat(63)}`)).toBe(false);
    expect(isHashLike("")).toBe(false);
  });
});

describe("Method B QR pipeline equivalence (offline)", () => {
  test("buildQrPayload produces the application's exact QR URL format", () => {
    const hash = `0x${"b".repeat(64)}`;
    expect(buildQrPayload(hash)).toBe(`https://certiproof.app/verify/${hash}`);
  });

  test("extractHashFromQrPayload mirrors the /verify_/$hash route param", () => {
    const hash = `0x${"c".repeat(64)}`;
    expect(extractHashFromQrPayload(buildQrPayload(hash))).toBe(hash);
    expect(extractHashFromQrPayload("https://certiproof.app/verify/")).toBeNull();
    expect(extractHashFromQrPayload("not-a-url")).toBeNull();
    expect(extractHashFromQrPayload("https://example.com/other")).toBeNull();
  });

  test("a malformed hash extracted from a QR payload flows through the same validation as Method A", async () => {
    const payload = "https://certiproof.app/verify/0xZZZ";
    const extracted = extractHashFromQrPayload(payload);
    expect(extracted).toBe("0xZZZ");
    const fromQr = await verifyCertificate(extracted!);
    const direct = await verifyCertificate("0xZZZ");
    expect(fromQr.outcome).toBe(direct.outcome);
    expect(fromQr.error?.type).toBe("invalid_hash");
  });
});

describe("analyzeDocument offline early returns", () => {
  test("a text file renamed to .pdf yields not_found (no certificate ID extracted, no network)", async () => {
    const file = new File(["This is not a certificate document."], "fake.pdf", {
      type: "application/pdf",
    });
    const result = await analyzeDocument(file);
    expect(result.outcome).toBe("not_found");
    expect(result.documentByteHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.metadataFingerprint).toBeUndefined();
  });

  test("an empty file yields not_found", async () => {
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    const result = await analyzeDocument(file);
    expect(result.outcome).toBe("not_found");
  });

  test("documentByteHash is the SHA-256 of the uploaded bytes (separate domain from metadataFingerprint)", async () => {
    const payload = new TextEncoder().encode("byte-hash-domain-check");
    const file = new File([payload], "check.pdf", { type: "application/pdf" });
    const result = await analyzeDocument(file);
    const digest = await crypto.subtle.digest("SHA-256", payload);
    const expected = `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    expect(result.documentByteHash).toBe(expected);
  });
});
