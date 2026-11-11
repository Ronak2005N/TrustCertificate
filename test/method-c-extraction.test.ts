import { describe, expect, test } from "bun:test";
import { generateCertificateBlob, type CertificateData } from "../src/lib/pdf/generate-certificate";
import { extractCertificateMetadata } from "../src/lib/pdf/extract-certificate-metadata";
import { generateCertificateFingerprint } from "../src/lib/certificate-fingerprint";
import { analyzeDocument } from "../src/lib/certificates";

/**
 * Method C extraction tests (Task 7). PDFs are produced by the application's
 * own generator (jsPDF); extraction and fingerprint recomputation are fully
 * offline — no RPC or Supabase access. analyzeDocument network-dependent
 * paths are covered by the live check script (scripts/live-method-c-check.ts).
 */

const BASE: CertificateData = {
  id: "CERT-2026-123456",
  recipientName: "Ada Lovelace",
  course: "Blockchain Fundamentals",
  organization: "CertiProof Institute",
  issueDate: "2026-05-18",
  certificateNumber: "CERT-2026-123456",
};

/** 1x1 transparent PNG data URL — exercises the QR/image addImage code path. */
const PNG_1PX_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function pdfBytes(overrides: Partial<CertificateData> = {}): Promise<Uint8Array> {
  const blob = await generateCertificateBlob({ ...BASE, ...overrides });
  return new Uint8Array(await blob.arrayBuffer());
}

describe("Method C extraction from real generated PDFs", () => {
  test("1+2+3+4. extracts certificate ID, recipient name, course and issue date", async () => {
    const extracted = extractCertificateMetadata(await pdfBytes());
    expect(extracted.certificateId).toBe(BASE.id);
    expect(extracted.recipientName).toBe(BASE.recipientName);
    expect(extracted.course).toBe(BASE.course);
    expect(extracted.issueDate).toBe(BASE.issueDate);
  });

  test("5. all four fields extracted from one PDF (complete=true), including with an embedded image", async () => {
    const extracted = extractCertificateMetadata(
      await pdfBytes({ qrCodeDataUrl: PNG_1PX_DATA_URL }),
    );
    expect(extracted.complete).toBe(true);
    expect(extracted.certificateId).toBe(BASE.id);
    expect(extracted.recipientName).toBe(BASE.recipientName);
    expect(extracted.course).toBe(BASE.course);
    expect(extracted.issueDate).toBe(BASE.issueDate);
  });

  test("6. recomputed fingerprint from extracted metadata equals the canonical fingerprint of the input metadata", async () => {
    const extracted = extractCertificateMetadata(await pdfBytes());
    expect(extracted.complete).toBe(true);
    const fromExtracted = await generateCertificateFingerprint({
      certificateId: extracted.certificateId!,
      recipientName: extracted.recipientName!,
      course: extracted.course!,
      issueDate: extracted.issueDate!,
    });
    const fromInput = await generateCertificateFingerprint({
      certificateId: BASE.id,
      recipientName: BASE.recipientName,
      course: BASE.course,
      issueDate: BASE.issueDate,
    });
    expect(fromExtracted).toBe(fromInput);
  });

  test("7. recipient-name modification changes extraction and alters the recomputed fingerprint", async () => {
    const original = extractCertificateMetadata(await pdfBytes());
    const tampered = extractCertificateMetadata(
      await pdfBytes({ recipientName: "Wrong Person" }),
    );
    expect(tampered.recipientName).toBe("Wrong Person");
    const originalFp = await generateCertificateFingerprint({
      certificateId: original.certificateId!,
      recipientName: original.recipientName!,
      course: original.course!,
      issueDate: original.issueDate!,
    });
    const tamperedFp = await generateCertificateFingerprint({
      certificateId: tampered.certificateId!,
      recipientName: tampered.recipientName!,
      course: tampered.course!,
      issueDate: tampered.issueDate!,
    });
    expect(tamperedFp).not.toBe(originalFp);
  });

  test("8. course modification changes extraction and alters the recomputed fingerprint", async () => {
    const original = extractCertificateMetadata(await pdfBytes());
    const tampered = extractCertificateMetadata(await pdfBytes({ course: "Wrong Course" }));
    expect(tampered.course).toBe("Wrong Course");
    const originalFp = await generateCertificateFingerprint({
      certificateId: original.certificateId!,
      recipientName: original.recipientName!,
      course: original.course!,
      issueDate: original.issueDate!,
    });
    const tamperedFp = await generateCertificateFingerprint({
      certificateId: tampered.certificateId!,
      recipientName: tampered.recipientName!,
      course: tampered.course!,
      issueDate: tampered.issueDate!,
    });
    expect(tamperedFp).not.toBe(originalFp);
  });

  test("9. issue-date modification changes extraction and alters the recomputed fingerprint", async () => {
    const original = extractCertificateMetadata(await pdfBytes());
    const tampered = extractCertificateMetadata(await pdfBytes({ issueDate: "2026-01-01" }));
    expect(tampered.issueDate).toBe("2026-01-01");
    const originalFp = await generateCertificateFingerprint({
      certificateId: original.certificateId!,
      recipientName: original.recipientName!,
      course: original.course!,
      issueDate: original.issueDate!,
    });
    const tamperedFp = await generateCertificateFingerprint({
      certificateId: tampered.certificateId!,
      recipientName: tampered.recipientName!,
      course: tampered.course!,
      issueDate: tampered.issueDate!,
    });
    expect(tamperedFp).not.toBe(originalFp);
  });

  test("10. certificate-ID modification changes extraction and alters the recomputed fingerprint", async () => {
    const original = extractCertificateMetadata(await pdfBytes());
    const tampered = extractCertificateMetadata(
      await pdfBytes({ id: "CERT-2099-999999", certificateNumber: "CERT-2099-999999" }),
    );
    expect(tampered.certificateId).toBe("CERT-2099-999999");
    const originalFp = await generateCertificateFingerprint({
      certificateId: original.certificateId!,
      recipientName: original.recipientName!,
      course: original.course!,
      issueDate: original.issueDate!,
    });
    const tamperedFp = await generateCertificateFingerprint({
      certificateId: tampered.certificateId!,
      recipientName: tampered.recipientName!,
      course: tampered.course!,
      issueDate: tampered.issueDate!,
    });
    expect(tamperedFp).not.toBe(originalFp);
  });

  test("11. missing recipient name → extraction incomplete (explicit, not a placeholder)", async () => {
    const extracted = extractCertificateMetadata(await pdfBytes({ recipientName: "" }));
    expect(extracted.recipientName).toBeNull();
    expect(extracted.complete).toBe(false);
    // ID and course remain extractable
    expect(extracted.certificateId).toBe(BASE.id);
    expect(extracted.course).toBe(BASE.course);
  });

  test("12. missing course → extraction incomplete (explicit, not a placeholder)", async () => {
    const extracted = extractCertificateMetadata(await pdfBytes({ course: "" }));
    expect(extracted.course).toBeNull();
    expect(extracted.complete).toBe(false);
    expect(extracted.certificateId).toBe(BASE.id);
    expect(extracted.recipientName).toBe(BASE.recipientName);
  });

  test("13. malformed PDF bytes do not crash the extractor and report incomplete extraction", () => {
    const garbage = new Uint8Array(512);
    for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) % 256;
    const extracted = extractCertificateMetadata(garbage);
    expect(extracted.certificateId).toBeNull();
    expect(extracted.recipientName).toBeNull();
    expect(extracted.course).toBeNull();
    expect(extracted.issueDate).toBeNull();
    expect(extracted.complete).toBe(false);
  });

  test("14. empty file does not crash the extractor or the verifier", async () => {
    expect(extractCertificateMetadata(new Uint8Array(0)).complete).toBe(false);
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    const result = await analyzeDocument(file);
    expect(result.outcome).toBe("not_found");
  });

  test("15. partial extraction: an ID-like line without anchors yields incomplete metadata", () => {
    // Minimal synthetic PDF-literal text: only an ID line, no anchor labels.
    const synthetic = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< >>\nstream\nBT (ID: CERT-2026-111111) Tj ET\nendstream\nendobj\n%%EOF",
    );
    const extracted = extractCertificateMetadata(synthetic);
    expect(extracted.certificateId).toBe("CERT-2026-111111");
    expect(extracted.recipientName).toBeNull();
    expect(extracted.course).toBeNull();
    expect(extracted.issueDate).toBeNull();
    expect(extracted.complete).toBe(false);
  });
});

describe("Method C extraction robustness", () => {
  test("names with parentheses and escapes survive extraction (PDF string escaping)", async () => {
    const extracted = extractCertificateMetadata(
      await pdfBytes({ recipientName: "Ana (María) O'Brien" }),
    );
    expect(extracted.recipientName).toBe("Ana (María) O'Brien");
  });

  test("ISO datetime issue dates printed by issuance normalize consistently", async () => {
    const extracted = extractCertificateMetadata(
      await pdfBytes({ issueDate: "2026-05-18T00:00:00+00:00" }),
    );
    expect(extracted.issueDate).toBe("2026-05-18T00:00:00+00:00");
    const fp = await generateCertificateFingerprint({
      certificateId: extracted.certificateId!,
      recipientName: extracted.recipientName!,
      course: extracted.course!,
      issueDate: extracted.issueDate!,
    });
    const expected = await generateCertificateFingerprint({
      certificateId: BASE.id,
      recipientName: BASE.recipientName,
      course: BASE.course,
      issueDate: "2026-05-18",
    });
    expect(fp).toBe(expected); // normalizeIssueDate collapses the datetime
  });
});
