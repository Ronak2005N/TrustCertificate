/**
 * Prototype service layer.
 *
 * Every function here is async and shaped like the real API it will replace
 * (Supabase queries + ethers.js calls against CertChainRegistry). Swapping in
 * the real backend means changing the body of these functions only.
 */
import { DEMO_CERTIFICATES, NETWORK, ORGANIZATION } from "./demo-data";
import type {
  BulkRow,
  Certificate,
  CertificateType,
  ForensicResult,
  VerificationResult,
} from "./types";

const store: Certificate[] = DEMO_CERTIFICATES.map((c) => ({ ...c }));

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function listCertificates(): Certificate[] {
  return store;
}

export function findCertificateById(id: string): Certificate | undefined {
  return store.find((c) => c.id.toLowerCase() === id.toLowerCase());
}

export function findCertificateByHash(hash: string): Certificate | undefined {
  return store.find((c) => c.hash.toLowerCase() === hash.trim().toLowerCase());
}

export function isHashLike(value: string) {
  return /^0x[0-9a-fA-F]{6,64}$/.test(value.trim());
}

/** Deterministic pseudo SHA-256 for prototype previews (not cryptographic). */
export function mockHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    h1 = (h1 ^ input.charCodeAt(i)) >>> 0;
    h1 = (h1 * 0x01000193) >>> 0;
    h2 = (h2 + input.charCodeAt(i) * (i + 7)) >>> 0;
    h2 = (h2 ^ (h2 << 5)) >>> 0;
  }
  let out = "";
  let seed = (h1 ^ h2) >>> 0;
  while (out.length < 64) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out += seed.toString(16).padStart(8, "0");
  }
  return `0x${out.slice(0, 64)}`;
}

export function shorten(value: string, lead = 6, tail = 4) {
  if (!value) return "";
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${formatDate(value)} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC`;
}

export function explorerTx(tx: string) {
  return `${NETWORK.explorer}/tx/${tx}`;
}

export function explorerAddress(address: string) {
  return `${NETWORK.explorer}/address/${address}`;
}

export const VERIFICATION_STAGES = [
  "Hash generated",
  "Blockchain queried",
  "Reading registry",
  "Checking revocation status",
];

export async function verifyCertificate(
  hash: string,
  onStage?: (index: number) => void,
): Promise<VerificationResult> {
  for (let i = 0; i < VERIFICATION_STAGES.length; i++) {
    onStage?.(i);
    await wait(520);
  }
  onStage?.(VERIFICATION_STAGES.length);

  const certificate = findCertificateByHash(hash);
  if (!certificate) {
    return { outcome: "not_found", hash, checks: [] };
  }

  const revoked = certificate.status === "revoked";
  return {
    outcome: revoked ? "revoked" : "verified",
    hash: certificate.hash,
    certificate,
    checks: [
      { label: "Hash Match", value: "PASS", pass: true },
      { label: "Issuer Record", value: "VERIFIED", pass: true },
      {
        label: "Revocation Status",
        value: revoked ? "REVOKED" : "ACTIVE",
        pass: !revoked,
      },
      { label: "Blockchain Record", value: "CONFIRMED", pass: true },
    ],
  };
}

export const ISSUANCE_STAGES = [
  "Generating cryptographic hash (SHA-256)",
  "Preparing blockchain transaction",
  "Submitting to Polygon Amoy",
  "Waiting for confirmation",
  "Generating certificate PDF",
  "Embedding QR code",
  "Complete",
];

export interface IssueInput {
  recipientName: string;
  recipientEmail: string;
  course: string;
  type: CertificateType;
  issueDate: string;
  description?: string;
}

function nextId() {
  const n = 2841 + store.length + 1;
  return `CERT-2026-${String(n).padStart(6, "0")}`;
}

export async function issueCertificate(
  input: IssueInput,
  onStage?: (index: number) => void,
): Promise<Certificate> {
  for (let i = 0; i < ISSUANCE_STAGES.length; i++) {
    onStage?.(i);
    await wait(i === 3 ? 1100 : 620);
  }

  const id = nextId();
  const hash = mockHash(`${id}|${input.recipientName}|${input.course}|${input.issueDate}`);
  const certificate: Certificate = {
    id,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    course: input.course,
    type: input.type,
    organization: ORGANIZATION.name,
    issueDate: input.issueDate,
    ...(input.description ? { description: input.description } : {}),
    hash,
    status: "active",
    chain: {
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      contract: NETWORK.contract,
      issuerWallet: ORGANIZATION.wallet,
      transactionHash: mockHash(`tx|${hash}`),
      block: 12890000 + store.length,
      confirmedAt: new Date().toISOString(),
    },
  };
  store.unshift(certificate);
  return certificate;
}

export const REVOKE_STAGES = [
  "Preparing revocation transaction",
  "Submitting to Polygon Amoy",
  "Waiting for confirmation",
];

export async function revokeCertificate(
  id: string,
  onStage?: (index: number) => void,
): Promise<Certificate | undefined> {
  for (let i = 0; i < REVOKE_STAGES.length; i++) {
    onStage?.(i);
    await wait(750);
  }
  const cert = store.find((c) => c.id === id);
  if (!cert) return undefined;
  cert.status = "revoked";
  cert.chain = {
    ...cert.chain,
    revocationTransactionHash: mockHash(`revoke|${cert.hash}`),
    revokedAt: new Date().toISOString(),
  };
  return cert;
}

export const FORENSIC_STAGES = [
  "Reading document",
  "Extracting certificate fields",
  "Generating document hash",
  "Comparing with blockchain registry",
];

export async function analyzeDocument(
  fileName: string,
  onStage?: (index: number) => void,
): Promise<ForensicResult> {
  for (let i = 0; i < FORENSIC_STAGES.length; i++) {
    onStage?.(i);
    await wait(700);
  }

  // Prototype heuristic: a file name containing "tamper" demos the mismatch path.
  const tampered = /tamper|fake|edit/i.test(fileName);
  const cert = store[0]!;

  if (tampered) {
    return {
      outcome: "mismatch",
      documentHash: mockHash(fileName),
      registeredHash: cert.hash,
      certificate: cert,
      fields: [
        { label: "Recipient", document: "Aarav Krishnan", registry: cert.recipientName, match: true },
        {
          label: "Course",
          document: "Master of Technology in Computer Science",
          registry: cert.course,
          match: false,
        },
        { label: "Issue date", document: "12 Jan 2026", registry: formatDate(cert.issueDate), match: false },
        { label: "Certificate ID", document: cert.id, registry: cert.id, match: true },
        { label: "Organization", document: cert.organization, registry: cert.organization, match: true },
      ],
    };
  }

  return {
    outcome: "match",
    documentHash: cert.hash,
    registeredHash: cert.hash,
    certificate: cert,
    fields: [
      { label: "Recipient", document: cert.recipientName, registry: cert.recipientName, match: true },
      { label: "Course", document: cert.course, registry: cert.course, match: true },
      {
        label: "Issue date",
        document: formatDate(cert.issueDate),
        registry: formatDate(cert.issueDate),
        match: true,
      },
      { label: "Certificate ID", document: cert.id, registry: cert.id, match: true },
      { label: "Organization", document: cert.organization, registry: cert.organization, match: true },
    ],
  };
}

export function parseCsv(text: string): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const rows: BulkRow[] = [];
  for (const line of lines.slice(1)) {
    const [name = "", email = "", course = "", date = "", type = ""] = line.split(",");
    const valid = Boolean(name && /.+@.+\..+/.test(email) && course && date);
    rows.push({
      name,
      email,
      course,
      date,
      type: type || "Completion",
      valid,
      ...(valid ? {} : { issue: !name ? "Missing name" : !email ? "Invalid email" : "Missing field" }),
    });
  }
  return rows;
}
