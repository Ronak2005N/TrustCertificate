/**
 * Structured metadata extraction from CertiProof-generated certificate PDFs.
 *
 * Target: text-based PDFs produced by this application's own generator
 * (src/lib/pdf/generate-certificate.ts, jsPDF standard fonts). The generator
 * renders each metadata value as its own PDF text-show operation with stable
 * anchor labels, in visual draw order:
 *
 *   ...
 *   "This is to certify that"
 *   <recipientName>                       (28pt bold, centered)
 *   "has successfully completed"
 *   <course>                              (18pt bold, centered)
 *   ...
 *   "Date: <issueDate>"
 *   "Certificate No: <certificateNumber>"
 *   "ID: <certificateId>"
 *   ...
 *
 * Strategy: collect every PDF literal string (...) from the file in stream
 * order, unescape PDF escape sequences, sanitize, then read values adjacent
 * to the anchor labels. jsPDF writes one literal string per doc.text() call
 * for standard fonts, and draws in visual order, so adjacency is reliable.
 * Image data (QR PNG) lives in separate objects written after the page
 * content stream, so any noise strings it produces can only appear after
 * the metadata anchors.
 *
 * Explicit extraction status: fields are null when not found and `complete`
 * is true only when ALL FOUR fields were extracted. Callers must never treat
 * a null field as valid metadata.
 *
 * Limitations (documented, by design):
 * - Scanned/image-only PDFs contain no text strings → all-null, complete=false.
 * - Non-CertiProof layouts without these anchor labels are not supported.
 * - No OCR is used and none is required for CertiProof-generated PDFs.
 *
 * This extracts METADATA used with the canonical registry fingerprint
 * protocol. It is NOT the document byte hash and must never be compared
 * against that domain.
 */

export interface ExtractedCertificateMetadata {
  certificateId: string | null;
  recipientName: string | null;
  course: string | null;
  issueDate: string | null;
  /** True only when all four metadata fields were extracted. */
  complete: boolean;
}

const CERT_ID_PATTERN = /CERT-\d{4}-\d{4,6}/;
const CERT_ID_FULL_PATTERN = /^CERT-\d{4}-\d{4,6}$/;
const DATE_VALUE_PATTERN =
  /\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i;

/** Static label lines emitted by the generator — never valid metadata values. */
const STATIC_LABEL_PATTERN =
  /^(this is to certify that|has successfully completed|certificate of completion|date:|certificate no:|id:|scan to verify|this certificate is blockchain-verified)/i;

/** Reject absurdly long captures (binary-noise guard). Names/courses are short. */
const MAX_FIELD_LENGTH = 300;

/** Unescape a PDF literal string body (the contents between the outer parens). */
function unescapePdfLiteral(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) break;
    i++;
    switch (next) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "(":
        out += "(";
        break;
      case ")":
        out += ")";
        break;
      case "\\":
        out += "\\";
        break;
      case "\n":
        break; // line continuation
      case "\r":
        if (body[i + 1] === "\n") i++;
        break;
      default:
        if (next >= "0" && next <= "7") {
          let oct = next;
          while (
            oct.length < 3 &&
            body[i + 1] !== undefined &&
            body[i + 1]! >= "0" &&
            body[i + 1]! <= "7"
          ) {
            oct += body[++i]!;
          }
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += next; // unknown escape: keep the character
        }
    }
  }
  return out;
}

/**
 * Sanitize an extracted literal: control characters become spaces (they are
 * never legitimate inside certificate metadata), ends are trimmed. Internal
 * regular spaces are PRESERVED exactly — canonicalization treats internal
 * whitespace as significant, so collapsing runs would create false mismatches.
 */
function sanitizeLine(raw: string): string | null {
  const mapped = raw.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001F\u007F-\u009F]/g,
    " ",
  );
  const trimmed = mapped.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_FIELD_LENGTH) return null;
  return trimmed;
}

/** Collect PDF literal strings in content-stream order (draw order). */
function collectPdfTextLines(pdfText: string): string[] {
  const lines: string[] = [];
  const re = /\(((?:[^()\\]|\\.)*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pdfText)) !== null) {
    const line = sanitizeLine(unescapePdfLiteral(m[1]!));
    if (line) lines.push(line);
  }
  return lines;
}

/** Value following a "Label: value" line, or null. */
function valueAfterLabel(lines: string[], label: string): string | null {
  const idx = lines.findIndex((l) => l.toLowerCase().startsWith(label));
  if (idx === -1) return null;
  const value = lines[idx]!.slice(label.length).replace(/^[:\s]+/, "").trim();
  return value || null;
}

/** The line immediately after an anchor phrase, or null if absent/static. */
function valueAfterAnchor(lines: string[], anchor: string): string | null {
  const idx = lines.findIndex((l) => l.toLowerCase().includes(anchor));
  if (idx === -1) return null;
  const candidate = lines[idx + 1];
  if (!candidate || STATIC_LABEL_PATTERN.test(candidate)) return null;
  return candidate;
}

/**
 * Extract certificate metadata from the raw bytes of a certificate PDF.
 * Never throws on malformed input; incomplete extraction is reported
 * explicitly via null fields and complete=false.
 */
export function extractCertificateMetadata(bytes: Uint8Array): ExtractedCertificateMetadata {
  const pdfText = new TextDecoder("latin1").decode(bytes);
  const lines = collectPdfTextLines(pdfText);

  // Certificate ID: prefer the "ID: ..." line; fall back to "Certificate No: ..."
  // and finally to the first CERT-YYYY-NNNNNN token anywhere.
  let certificateId: string | null = null;
  const idValue = valueAfterLabel(lines, "id:");
  if (idValue) {
    const full = idValue.match(CERT_ID_FULL_PATTERN);
    if (full) certificateId = full[0];
    else certificateId = idValue.match(CERT_ID_PATTERN)?.[0] ?? null;
  }
  if (!certificateId) {
    const certNoValue = valueAfterLabel(lines, "certificate no:");
    if (certNoValue) certificateId = certNoValue.match(CERT_ID_PATTERN)?.[0] ?? null;
  }
  if (!certificateId) {
    for (const line of lines) {
      const m = line.match(CERT_ID_PATTERN);
      if (m) {
        certificateId = m[0];
        break;
      }
    }
  }

  // Recipient name: the line right after "This is to certify that".
  let recipientName: string | null = null;
  const recipient = valueAfterAnchor(lines, "this is to certify that");
  if (recipient) recipientName = recipient;

  // Course: the line right after "has successfully completed".
  let course: string | null = null;
  const courseValue = valueAfterAnchor(lines, "has successfully completed");
  if (courseValue) course = courseValue;

  // Issue date: the value after "Date:", validated as date-like.
  let issueDate: string | null = null;
  const dateValue = valueAfterLabel(lines, "date:");
  if (dateValue && DATE_VALUE_PATTERN.test(dateValue)) issueDate = dateValue;

  return {
    certificateId,
    recipientName,
    course,
    issueDate,
    complete: Boolean(certificateId && recipientName && course && issueDate),
  };
}
