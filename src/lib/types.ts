export type CertificateStatus = "active" | "revoked" | "pending";

export type CertificateType =
  | "Degree"
  | "Completion"
  | "Excellence"
  | "Participation"
  | "Internship"
  | "Certification";

export const CERTIFICATE_TYPES: CertificateType[] = [
  "Degree",
  "Completion",
  "Excellence",
  "Participation",
  "Internship",
  "Certification",
];

export interface BlockchainRecord {
  network: string;
  chainId: number;
  contract: string;
  issuerWallet: string;
  transactionHash: string;
  block: number;
  confirmedAt: string;
  revocationTransactionHash?: string;
  revokedAt?: string;
}

export interface Certificate {
  id: string;
  recipientName: string;
  recipientEmail: string;
  course: string;
  type: CertificateType;
  organization: string;
  issueDate: string;
  description?: string;
  hash: string;
  status: CertificateStatus;
  chain: BlockchainRecord;
}

export type VerificationOutcome = "verified" | "revoked" | "not_found" | "error";

export interface VerificationError {
  type: "invalid_hash" | "rpc_error" | "contract_error" | "not_found" | "network_error";
  message: string;
}

export interface VerificationResult {
  outcome: VerificationOutcome;
  hash: string;
  certificate?: Certificate;
  checks: { label: string; value: string; pass: boolean }[];
  error?: VerificationError;
}

export interface ForensicField {
  label: string;
  document: string;
  registry: string;
  match: boolean;
}

export interface ForensicResult {
  outcome: "match" | "mismatch" | "not_found";
  documentHash: string;
  registeredHash?: string;
  fields: ForensicField[];
  certificate?: Certificate;
}

export interface BulkRow {
  name: string;
  email: string;
  course: string;
  date: string;
  type: string;
  valid: boolean;
  issue?: string;
}

export interface StageUpdate {
  index: number;
  label: string;
  state: "pending" | "active" | "done";
}
