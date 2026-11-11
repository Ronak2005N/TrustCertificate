import { describe, expect, test } from "bun:test";
import {
  canonicalizeCertificateMetadata,
  generateCertificateFingerprint,
  normalizeIssueDate,
  type CertificateMetadata,
} from "../src/lib/certificate-fingerprint";

const base: CertificateMetadata = {
  certificateId: "CERT-2026-100001",
  recipientName: "Asha Kumar",
  course: "B.Tech Computer Science and Engineering",
  issueDate: "2026-05-18",
};

async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CANONICAL_BASE =
  "CERT-2026-100001|Asha Kumar|B.Tech Computer Science and Engineering|2026-05-18";

describe("canonicalizeCertificateMetadata", () => {
  test("fixed field order and separator produce the defined canonical string", () => {
    expect(canonicalizeCertificateMetadata(base)).toBe(CANONICAL_BASE);
  });

  test("object key insertion order does not affect the canonical string", () => {
    const shuffled: CertificateMetadata = {
      issueDate: "2026-05-18",
      course: "B.Tech Computer Science and Engineering",
      certificateId: "CERT-2026-100001",
      recipientName: "Asha Kumar",
    };
    expect(canonicalizeCertificateMetadata(shuffled)).toBe(CANONICAL_BASE);
  });

  test("leading and trailing whitespace is trimmed deterministically", () => {
    const padded: CertificateMetadata = {
      certificateId: "  CERT-2026-100001 ",
      recipientName: " Asha Kumar  ",
      course: "\tB.Tech Computer Science and Engineering\n",
      issueDate: " 2026-05-18 ",
    };
    expect(canonicalizeCertificateMetadata(padded)).toBe(CANONICAL_BASE);
    expect(canonicalizeCertificateMetadata(padded)).toBe(canonicalizeCertificateMetadata(base));
  });

  test("internal whitespace is significant", () => {
    const doubleSpace: CertificateMetadata = { ...base, recipientName: "Asha  Kumar" };
    expect(canonicalizeCertificateMetadata(doubleSpace)).not.toBe(CANONICAL_BASE);
  });

  test("issueDate normalizes to zero-padded ISO", () => {
    expect(normalizeIssueDate("2026-5-8")).toBe("2026-05-08");
    expect(normalizeIssueDate(" 2026-5-8 ")).toBe("2026-05-08");
    expect(normalizeIssueDate("2026-05-18")).toBe("2026-05-18");
    expect(canonicalizeCertificateMetadata({ ...base, issueDate: "2026-5-18" })).toBe(
      CANONICAL_BASE,
    );
  });

  test("TIMESTAMPTZ values reduce to their date component", () => {
    expect(normalizeIssueDate("2026-05-18T00:00:00+00:00")).toBe("2026-05-18");
    expect(normalizeIssueDate("2026-05-18T00:00:00Z")).toBe("2026-05-18");
    expect(normalizeIssueDate("2026-05-18 00:00:00+00:00")).toBe("2026-05-18");
    expect(normalizeIssueDate("2026-5-18T10:30:00+05:30")).toBe("2026-05-18");
    expect(
      canonicalizeCertificateMetadata({
        ...base,
        issueDate: "2026-05-18T00:00:00+00:00",
      }),
    ).toBe(CANONICAL_BASE);
  });

  test("TIMESTAMPTZ date round-trip produces the same fingerprint as the plain date", async () => {
    const fromTimestamp = await generateCertificateFingerprint({
      ...base,
      issueDate: "2026-05-18T00:00:00+00:00",
    });
    expect(fromTimestamp).toBe(await generateCertificateFingerprint(base));
  });

  test("non-ISO dates are kept verbatim (trimmed)", () => {
    expect(normalizeIssueDate("18/05/2026")).toBe("18/05/2026");
    expect(normalizeIssueDate(" May 18, 2026 ")).toBe("May 18, 2026");
  });
});

describe("generateCertificateFingerprint", () => {
  test("deterministic: same metadata twice produces identical fingerprints", async () => {
    const a = await generateCertificateFingerprint(base);
    const b = await generateCertificateFingerprint({ ...base });
    expect(a).toBe(b);
  });

  test("protocol vector: 0x + SHA-256 (UTF-8) of the exact canonical string", async () => {
    const expected = `0x${await sha256hex(CANONICAL_BASE)}`;
    expect(await generateCertificateFingerprint(base)).toBe(expected);
  });

  test("legacy compatibility: equals the original id|name|course|date scheme", async () => {
    const legacy = `0x${await sha256hex(
      `${base.certificateId}|${base.recipientName}|${base.course}|${base.issueDate}`,
    )}`;
    expect(await generateCertificateFingerprint(base)).toBe(legacy);
  });

  test("returns 0x-prefixed 64-char lowercase hex", async () => {
    const fp = await generateCertificateFingerprint(base);
    expect(fp).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("TEST: changed recipient name does not match", async () => {
    const mutated = await generateCertificateFingerprint({ ...base, recipientName: "Asha Kumari" });
    expect(mutated).not.toBe(await generateCertificateFingerprint(base));
  });

  test("TEST: changed course does not match", async () => {
    const mutated = await generateCertificateFingerprint({
      ...base,
      course: "B.Tech Computer Science",
    });
    expect(mutated).not.toBe(await generateCertificateFingerprint(base));
  });

  test("TEST: changed issue date does not match", async () => {
    const mutated = await generateCertificateFingerprint({ ...base, issueDate: "2026-05-19" });
    expect(mutated).not.toBe(await generateCertificateFingerprint(base));
  });

  test("TEST: changed certificate ID does not match", async () => {
    const mutated = await generateCertificateFingerprint({
      ...base,
      certificateId: "CERT-2026-100002",
    });
    expect(mutated).not.toBe(await generateCertificateFingerprint(base));
  });

  test("single-character changes alter the fingerprint", async () => {
    const mutated = await generateCertificateFingerprint({
      ...base,
      course: "B.Tech computer Science and Engineering",
    });
    expect(mutated).not.toBe(await generateCertificateFingerprint(base));
  });

  test("unicode recipient names are hashed as UTF-8", async () => {
    const unicode: CertificateMetadata = { ...base, recipientName: "Ashä Kumar 王伟" };
    const expected = `0x${await sha256hex(
      `${unicode.certificateId}|${unicode.recipientName}|${unicode.course}|${unicode.issueDate}`,
    )}`;
    expect(await generateCertificateFingerprint(unicode)).toBe(expected);
    expect(await generateCertificateFingerprint(unicode)).not.toBe(
      await generateCertificateFingerprint(base),
    );
  });

  test("whitespace-equivalent metadata produces the same fingerprint", async () => {
    const padded: CertificateMetadata = {
      certificateId: " CERT-2026-100001",
      recipientName: "Asha Kumar ",
      course: " B.Tech Computer Science and Engineering",
      issueDate: "2026-05-18 ",
    };
    expect(await generateCertificateFingerprint(padded)).toBe(
      await generateCertificateFingerprint(base),
    );
  });

  test("date form 2026-5-18 and 2026-05-18 produce the same fingerprint", async () => {
    const unpadded = await generateCertificateFingerprint({ ...base, issueDate: "2026-5-18" });
    expect(unpadded).toBe(await generateCertificateFingerprint(base));
  });
});
