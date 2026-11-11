/**
 * Blockchain transaction confirmation state machine.
 *
 * CertiProof must never report an unmined transaction as confirmed. This
 * module owns the ONLY logic that decides whether a submitted transaction is:
 *
 *   confirmed — a REAL mined receipt was observed (valid blockNumber > 0 and
 *               transaction status === 1, per ethers v6 receipt semantics).
 *   failed    — one of:
 *                 * the submission itself threw (no tx hash exists),
 *                 * a real mined receipt shows status 0 (reverted),
 *                 * the receipt exists but carries no success status,
 *               * the transaction was definitively replaced/cancelled.
 *   pending   — the transaction was submitted (tx hash preserved) but no valid
 *               receipt has been observed yet. A confirmation TIMEOUT is
 *               pending/unknown — it is NOT success and NOT failure.
 *
 * Rules enforced here:
 *   - A synthetic receipt (e.g. the legacy `{ blockNumber: 0, status: 1 }`
 *     fallback) is never treated as confirmed.
 *   - No receipt is ever fabricated; the receipt field only ever holds an
 *     object returned by ethers/RPC (or one attached to an ethers error).
 *   - The confirmation timeout timer is always cleared when the confirmation
 *     promise settles (success, failure or timeout).
 *   - `waitForTransactionConfirmation` never throws: unexpected internal
 *     errors degrade to `pending` with the tx hash preserved (safe direction:
 *     never claim success without evidence).
 *
 * The 60s timeout is the measured Task 3 baseline and is deliberately NOT
 * increased here — this task fixes correctness, not latency.
 */
import type { TransactionReceipt } from "ethers";

/** Measured baseline from Task 3. Do not change without a measurement task. */
export const CONFIRMATION_TIMEOUT_MS = 60_000;

export type TransactionConfirmationState = "confirmed" | "failed" | "pending";

export type FailedConfirmationReason =
  | "mined_reverted"
  | "receipt_status_unknown"
  | "submission_error"
  | "replacement_cancelled";

export type PendingConfirmationReason =
  | "timeout_no_receipt"
  | "wait_error_no_receipt"
  | "receipt_not_mined";

export type TransactionConfirmation =
  | {
      state: "confirmed";
      reason: "mined_success";
      txHash: string;
      receipt: TransactionReceipt;
    }
  | {
      state: "failed";
      reason: FailedConfirmationReason;
      /** null only when the submission itself failed (no hash exists). */
      txHash: string | null;
      receipt: TransactionReceipt | null;
      error?: unknown;
    }
  | {
      state: "pending";
      reason: PendingConfirmationReason;
      txHash: string;
      receipt: null;
      error?: unknown;
    };

/** Minimal structural view of an ethers TransactionResponse. */
export interface ConfirmationTarget {
  hash: string;
  wait: () => Promise<TransactionReceipt | null>;
  provider?: {
    getTransactionReceipt: (txHash: string) => Promise<TransactionReceipt | null>;
  };
}

/**
 * Injectable timers — production uses the globals; tests use this seam to
 * assert that the confirmation timer is cleared on settle.
 */
export interface ConfirmationSchedule {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ConfirmationOptions {
  timeoutMs?: number;
  /**
   * Receipt lookup for the post-timeout / post-error final state check.
   * Defaults to `target.provider.getTransactionReceipt` when absent.
   */
  fetchReceipt?: (txHash: string) => Promise<TransactionReceipt | null>;
  /** Called once, after submission succeeded and before the wait starts. */
  onSubmitted?: (tx: { hash: string }) => void;
  schedule?: ConfirmationSchedule;
}

/** One-shot receipt classification used for later re-checks (no polling). */
export type TransactionStateCheck =
  | { state: "confirmed"; receipt: TransactionReceipt }
  | { state: "failed"; receipt: TransactionReceipt }
  | { state: "pending"; receipt: null };

class ConfirmationTimeoutSignal extends Error {
  constructor() {
    super("confirmation timeout reached");
    this.name = "ConfirmationTimeoutSignal";
  }
}

const defaultSchedule: ConfirmationSchedule = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * A receipt is real evidence of mining only when it reports a positive block
 * number. `blockNumber: 0` (or anything non-positive/non-finite) is never
 * valid — that is exactly the synthetic-receipt shape this task removed.
 */
export function isValidReceipt(receipt: unknown): receipt is TransactionReceipt {
  if (typeof receipt !== "object" || receipt === null) return false;
  const blockNumber = (receipt as { blockNumber?: unknown }).blockNumber;
  return typeof blockNumber === "number" && Number.isFinite(blockNumber) && blockNumber > 0;
}

function classifyReceipt(
  receipt: TransactionReceipt | null | undefined,
  fallbackHash: string,
): TransactionConfirmation | null {
  if (!isValidReceipt(receipt)) return null;
  const txHash = receipt.hash || fallbackHash;
  if (!txHash) return null;
  if (receipt.status === 1) {
    return { state: "confirmed", reason: "mined_success", txHash, receipt };
  }
  if (receipt.status === 0) {
    return { state: "failed", reason: "mined_reverted", txHash, receipt };
  }
  // status === null: mined, but no success evidence → never confirmed.
  return { state: "failed", reason: "receipt_status_unknown", txHash, receipt };
}

/** ethers attaches the receipt to CALL_EXCEPTION (revert) / REPLACED errors. */
function receiptFromError(error: unknown): TransactionReceipt | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as { receipt?: unknown; transactionReceipt?: unknown };
  const candidate = e.receipt ?? e.transactionReceipt;
  return isValidReceipt(candidate) ? candidate : null;
}

/** A cancelled/replaced transaction can never mine → definitive failure. */
function isCancelledReplacement(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; cancelled?: unknown };
  return e.code === "TRANSACTION_REPLACED" && e.cancelled === true;
}

async function safeFetchReceipt(
  txHash: string,
  options: ConfirmationOptions,
  target: ConfirmationTarget,
): Promise<TransactionReceipt | null> {
  try {
    if (options.fetchReceipt) {
      return (await options.fetchReceipt(txHash)) ?? null;
    }
    if (target.provider) {
      return (await target.provider.getTransactionReceipt(txHash)) ?? null;
    }
    return null;
  } catch {
    // The check itself failed — indistinguishable from "not observed yet".
    return null;
  }
}

async function resolveAfterWaitError(
  error: unknown,
  txHash: string,
  options: ConfirmationOptions,
  target: ConfirmationTarget,
): Promise<TransactionConfirmation> {
  if (isCancelledReplacement(error)) {
    return {
      state: "failed",
      reason: "replacement_cancelled",
      txHash,
      receipt: null,
      ...(error === undefined ? {} : { error }),
    };
  }

  const fromErrorReceipt = classifyReceipt(receiptFromError(error), txHash);
  if (fromErrorReceipt) return fromErrorReceipt;

  const fetched = await safeFetchReceipt(txHash, options, target);
  const late = classifyReceipt(fetched, txHash);
  if (late) return late;

  // No receipt and no definitive failure → the transaction may still mine.
  return {
    state: "pending",
    reason: "wait_error_no_receipt",
    txHash,
    receipt: null,
    ...(error === undefined ? {} : { error }),
  };
}

/**
 * Wait for a submitted transaction to be mined, bounded by a confirmation
 * timeout. Never throws. On timeout it performs ONE final receipt check; if
 * that check finds a real receipt the transaction is classified from it,
 * otherwise the result is `pending` with the tx hash preserved.
 */
export async function waitForTransactionConfirmation(
  target: ConfirmationTarget,
  options: ConfirmationOptions = {},
): Promise<TransactionConfirmation> {
  const timeoutMs = options.timeoutMs ?? CONFIRMATION_TIMEOUT_MS;
  const schedule = options.schedule ?? defaultSchedule;
  const txHash = target.hash;

  let timeoutHandle: unknown;
  const timeoutSignal = new Promise<never>((_, reject) => {
    timeoutHandle = schedule.setTimeout(() => reject(new ConfirmationTimeoutSignal()), timeoutMs);
  });

  let waitPromise: Promise<TransactionReceipt | null>;
  try {
    waitPromise = target.wait();
  } catch (error) {
    schedule.clearTimeout(timeoutHandle);
    try {
      return await resolveAfterWaitError(error, txHash, options, target);
    } catch (unexpected) {
      return {
        state: "pending",
        reason: "wait_error_no_receipt",
        txHash,
        receipt: null,
        ...(unexpected === undefined ? {} : { error: unexpected }),
      };
    }
  }

  try {
    const receipt = await Promise.race([waitPromise, timeoutSignal]);
    const direct = classifyReceipt(receipt, txHash);
    if (direct) return direct;

    // wait() settled without usable evidence (null / blockNumber 0):
    // consult the chain once before declaring the state unknown.
    const fetched = await safeFetchReceipt(txHash, options, target);
    const late = classifyReceipt(fetched, txHash);
    if (late) return late;
    return { state: "pending", reason: "receipt_not_mined", txHash, receipt: null };
  } catch (error) {
    if (error instanceof ConfirmationTimeoutSignal) {
      // TIMEOUT ≠ FAILED and TIMEOUT ≠ SUCCESS: one final receipt check.
      const fetched = await safeFetchReceipt(txHash, options, target);
      const late = classifyReceipt(fetched, txHash);
      if (late) return late;
      return { state: "pending", reason: "timeout_no_receipt", txHash, receipt: null };
    }
    try {
      return await resolveAfterWaitError(error, txHash, options, target);
    } catch (unexpected) {
      return {
        state: "pending",
        reason: "wait_error_no_receipt",
        txHash,
        receipt: null,
        ...(unexpected === undefined ? {} : { error: unexpected }),
      };
    }
  } finally {
    // Cleared on success, failure and timeout alike — no dangling timers.
    schedule.clearTimeout(timeoutHandle);
  }
}

/**
 * Submit a transaction and then confirm it. If the submission itself throws
 * the result is `failed / submission_error` (no tx hash exists). If submission
 * succeeds the transaction hash is preserved and the confirmation state
 * machine takes over.
 */
export async function submitTransactionAndConfirm(
  submit: () => Promise<ConfirmationTarget>,
  options: ConfirmationOptions = {},
): Promise<TransactionConfirmation> {
  let tx: ConfirmationTarget;
  try {
    tx = await submit();
  } catch (error) {
    return {
      state: "failed",
      reason: "submission_error",
      txHash: null,
      receipt: null,
      ...(error === undefined ? {} : { error }),
    };
  }
  if (!tx || typeof tx.hash !== "string" || tx.hash.length === 0) {
    return {
      state: "failed",
      reason: "submission_error",
      txHash: null,
      receipt: null,
      error: new Error("Transaction submission returned no transaction hash"),
    };
  }
  if (options.onSubmitted) options.onSubmitted({ hash: tx.hash });
  return waitForTransactionConfirmation(tx, options);
}

/**
 * One-shot receipt check for a transaction hash (used by later re-checks).
 * No polling: a single RPC lookup classifies the hash as confirmed / failed /
 * pending. Throws never — RPC errors classify as pending (unknown).
 */
export async function getTransactionState(
  txHash: string,
  fetchReceipt: (txHash: string) => Promise<TransactionReceipt | null>,
): Promise<TransactionStateCheck> {
  try {
    const receipt = await fetchReceipt(txHash);
    if (isValidReceipt(receipt)) {
      return receipt.status === 1
        ? { state: "confirmed", receipt }
        : { state: "failed", receipt };
    }
    return { state: "pending", receipt: null };
  } catch {
    return { state: "pending", receipt: null };
  }
}
