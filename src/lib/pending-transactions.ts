/**
 * In-memory registry of transactions that were submitted but not yet observed
 * as mined (confirmation `pending`). Keys are transaction hashes — hashes are
 * public values, not secrets. No private keys or credentials are stored.
 *
 * This is the session-lifetime mechanism that preserves a pending transaction
 * so it can be re-checked later (CASE: hash exists → receipt becomes
 * available → the application recognizes it as confirmed). Like the
 * certificate store it lives only for the current browser session; a page
 * reload loses the payload, but the tx hash shown to the user still resolves
 * on the block explorer and on-chain lookups remain authoritative.
 *
 * Pending records are NEVER written to Supabase — a certificate is persisted
 * only after a real mined receipt exists.
 */
import type { CertificateType } from "./types";

export interface PendingIssuanceInput {
  recipientName: string;
  recipientEmail: string;
  course: string;
  type: CertificateType;
  issueDate: string;
  description?: string;
}

export type PendingTransactionRecord =
  | {
      kind: "issuance";
      txHash: string;
      certificateId: string;
      /** SHA-256 metadata fingerprint that was submitted on-chain. */
      fingerprint: string;
      ipfsCid: string;
      issuerWallet: string;
      input: PendingIssuanceInput;
      submittedAt: string;
    }
  | {
      kind: "revocation";
      txHash: string;
      certificateId: string;
      submittedAt: string;
    };

const registry = new Map<string, PendingTransactionRecord>();

export function recordPendingTransaction(record: PendingTransactionRecord): void {
  registry.set(record.txHash, record);
}

export function getPendingTransaction(txHash: string): PendingTransactionRecord | null {
  return registry.get(txHash) ?? null;
}

export function removePendingTransaction(txHash: string): void {
  registry.delete(txHash);
}

export function listPendingTransactions(): PendingTransactionRecord[] {
  return Array.from(registry.values());
}

/** For tests only. */
export function resetPendingTransactions(): void {
  registry.clear();
}
