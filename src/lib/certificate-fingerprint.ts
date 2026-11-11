/**
 * Single source of truth for the CertiProof certificate fingerprint protocol.
 *
 * Certificate metadata fingerprint (the registry key, stored on-chain and in
 * Supabase, encoded in the QR code):
 *
 *   certificateId
 *   | recipientName
 *   | course
 *   | issueDate
 *   → deterministic canonical string (UTF-8)
 *   → SHA-256
 *   → 0x-prefixed lowercase hex fingerprint
 *
 * This is NOT a hash of the generated PDF bytes. The SHA-256 of a document's
 * bytes is a separate concept ("document byte hash") used only for file
 * integrity reporting and never compared against the on-chain fingerprint.
 *
 * Canonicalization rules (identical for issuance and verification):
 * - fixed field order: certificateId, recipientName, course, issueDate
 * - fixed separator: "|"
 * - text fields are trimmed of leading/trailing whitespace;
 *   internal whitespace is significant (any byte change alters the fingerprint)
 * - issueDate is normalized to YYYY-MM-DD when it is an ISO-style date,
 *   otherwise the trimmed value is kept verbatim
 * - encoded as UTF-8 before hashing
 */
import { computeSHA256 } from "./crypto";

export interface CertificateMetadata {
  certificateId: string;
  recipientName: string;
  course: string;
  issueDate: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const ISO_DATETIME_PATTERN = /^(\d{4}-\d{1,2}-\d{1,2})(?:[T ].*)?$/;

/**
 * Deterministic date normalization:
 * - ISO datetimes (e.g. "2026-05-18T00:00:00+00:00" from TIMESTAMPTZ columns)
 *   reduce to their date component
 * - ISO-style dates are zero-padded to YYYY-MM-DD
 * - any other format is kept verbatim (trimmed)
 */
export function normalizeIssueDate(value: string): string {
  const trimmed = value.trim();
  const datetime = trimmed.match(ISO_DATETIME_PATTERN);
  const datePart = datetime ? datetime[1]! : trimmed;
  const match = datePart.match(ISO_DATE_PATTERN);
  if (!match) return datePart;
  const [, year, month, day] = match;
  return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

/** Deterministic canonical representation of certificate metadata. */
export function canonicalizeCertificateMetadata(data: CertificateMetadata): string {
  return [
    data.certificateId.trim(),
    data.recipientName.trim(),
    data.course.trim(),
    normalizeIssueDate(data.issueDate),
  ].join("|");
}

/**
 * SHA-256 metadata fingerprint of a certificate.
 * Returns a 0x-prefixed, 64-character lowercase hex string.
 * Reused by issuance, hash verification, QR verification and document checks.
 */
export async function generateCertificateFingerprint(data: CertificateMetadata): Promise<string> {
  const canonical = canonicalizeCertificateMetadata(data);
  const hex = await computeSHA256(canonical);
  return `0x${hex}`;
}
