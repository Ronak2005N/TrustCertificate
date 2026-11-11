import { beforeEach, describe, expect, test } from "bun:test";
import type { TransactionReceipt } from "ethers";
import {
  CONFIRMATION_TIMEOUT_MS,
  getTransactionState,
  isValidReceipt,
  submitTransactionAndConfirm,
  waitForTransactionConfirmation,
  type ConfirmationSchedule,
  type ConfirmationTarget,
} from "../src/lib/blockchain/confirmation";
import {
  getPendingTransaction,
  listPendingTransactions,
  recordPendingTransaction,
  removePendingTransaction,
  resetPendingTransactions,
} from "../src/lib/pending-transactions";

const TX_HASH = `0x${"ab".repeat(32)}`;
const REPLACEMENT_HASH = `0x${"cd".repeat(32)}`;

function makeReceipt(
  overrides: Partial<{ hash: string; blockNumber: number; status: number | null }> = {},
): TransactionReceipt {
  return {
    hash: TX_HASH,
    blockNumber: 8_765_432,
    status: 1,
    ...overrides,
  } as unknown as TransactionReceipt;
}

function makeTarget(
  wait: () => Promise<TransactionReceipt | null>,
  provider?: ConfirmationTarget["provider"],
): ConfirmationTarget {
  return provider ? { hash: TX_HASH, wait, provider } : { hash: TX_HASH, wait };
}

const neverResolves = () => new Promise<TransactionReceipt | null>(() => {});

/**
 * Timer seam that records every handle created/cleared so tests can assert
 * the confirmation timer never outlives the confirmation promise.
 */
function recordingSchedule() {
  type Handle = { native: ReturnType<typeof setTimeout>; fired: boolean; ms: number };
  const handles: Handle[] = [];
  const cleared: Handle[] = [];
  const schedule: ConfirmationSchedule = {
    setTimeout: (handler: () => void, ms: number) => {
      const handle: Handle = {
        native: setTimeout(() => {
          handle.fired = true;
          handler();
        }, ms),
        fired: false,
        ms,
      };
      handles.push(handle);
      return handle;
    },
    clearTimeout: (handle: unknown) => {
      const typed = handle as Handle;
      cleared.push(typed);
      if (!typed.fired) clearTimeout(typed.native);
    },
  };
  return { schedule, handles, cleared };
}

beforeEach(() => {
  resetPendingTransactions();
});

describe("confirmation baseline", () => {
  test("the measured 60s confirmation timeout baseline is unchanged", () => {
    expect(CONFIRMATION_TIMEOUT_MS).toBe(60_000);
  });

  test("a blockNumber: 0 receipt is never valid evidence of mining", () => {
    expect(isValidReceipt(makeReceipt({ blockNumber: 0, status: 1 }))).toBe(false);
    expect(isValidReceipt(makeReceipt({ blockNumber: -1 }))).toBe(false);
    expect(isValidReceipt({ status: 1 })).toBe(false);
    expect(isValidReceipt(null)).toBe(false);
    expect(isValidReceipt(makeReceipt({ blockNumber: 42 }))).toBe(true);
  });
});

describe("waitForTransactionConfirmation — CASE A: real successful receipt", () => {
  test("TEST 1: submitted + real successful receipt → confirmed", async () => {
    const receipt = makeReceipt({ status: 1 });
    const result = await waitForTransactionConfirmation(makeTarget(() => Promise.resolve(receipt)));

    expect(result.state).toBe("confirmed");
    expect(result.reason).toBe("mined_success");
    expect(result.txHash).toBe(TX_HASH);
    expect(result.receipt).toBe(receipt);
    expect(result.receipt!.blockNumber).toBeGreaterThan(0);
  });
});

describe("waitForTransactionConfirmation — CASE B: failed receipt", () => {
  test("TEST 2: submitted + receipt with status 0 → failed", async () => {
    const receipt = makeReceipt({ status: 0 });
    const result = await waitForTransactionConfirmation(makeTarget(() => Promise.resolve(receipt)));

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("mined_reverted");
    expect(result.txHash).toBe(TX_HASH);
    expect(result.receipt).toBe(receipt);
  });

  test("wait() rejecting with a CALL_EXCEPTION receipt (revert) → failed", async () => {
    const receipt = makeReceipt({ status: 0 });
    const result = await waitForTransactionConfirmation(
      makeTarget(() => Promise.reject(Object.assign(new Error("execution reverted"), {
        code: "CALL_EXCEPTION",
        receipt,
      }))),
    );

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("mined_reverted");
    expect(result.receipt).toBe(receipt);
  });

  test("a mined receipt without a success status is never confirmed", async () => {
    const receipt = makeReceipt({ status: null });
    const result = await waitForTransactionConfirmation(makeTarget(() => Promise.resolve(receipt)));

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("receipt_status_unknown");
    expect(result.state).not.toBe("confirmed");
  });
});

describe("waitForTransactionConfirmation — CASE C: timeout without receipt", () => {
  test("TEST 3: submitted + timeout + no receipt → pending, MUST NOT be success", async () => {
    const result = await waitForTransactionConfirmation(makeTarget(neverResolves), {
      timeoutMs: 30,
      fetchReceipt: () => Promise.resolve(null),
    });

    expect(result.state).toBe("pending");
    expect(result.reason).toBe("timeout_no_receipt");
    expect(result.receipt).toBeNull();
    expect(result.state).not.toBe("confirmed");
    expect(result.txHash).toBe(TX_HASH);
  });

  test("TEST 9: a synthetic blockNumber: 0 receipt is not treated as confirmed", async () => {
    const synthetic = makeReceipt({ blockNumber: 0, status: 1 });
    const result = await waitForTransactionConfirmation(makeTarget(() => Promise.resolve(synthetic)), {
      fetchReceipt: () => Promise.resolve(null),
    });

    expect(result.state).toBe("pending");
    expect(result.reason).toBe("receipt_not_mined");
    expect(result.state).not.toBe("confirmed");
    expect(result.receipt).toBeNull();
  });

  test("TEST 9b: a synthetic blockNumber: 0 receipt from the final check stays pending", async () => {
    const synthetic = makeReceipt({ blockNumber: 0, status: 1 });
    const result = await waitForTransactionConfirmation(makeTarget(neverResolves), {
      timeoutMs: 30,
      fetchReceipt: () => Promise.resolve(synthetic),
    });

    expect(result.state).toBe("pending");
    expect(result.state).not.toBe("confirmed");
    expect(result.receipt).toBeNull();
  });
});

describe("waitForTransactionConfirmation — CASE D/E: wait errors", () => {
  test("TEST 8: tx hash is preserved when confirmation stays pending", async () => {
    const result = await waitForTransactionConfirmation(
      makeTarget(() => Promise.reject(new Error("network error while polling"))),
      { fetchReceipt: () => Promise.resolve(null) },
    );

    expect(result.state).toBe("pending");
    expect(result.reason).toBe("wait_error_no_receipt");
    expect(result.txHash).toBe(TX_HASH);
    expect(result.receipt).toBeNull();
    expect((result as { error?: unknown }).error).toBeInstanceOf(Error);
  });

  test("TEST 5: timeout, but a receipt appears during the final check → confirmed", async () => {
    const receipt = makeReceipt({ status: 1, blockNumber: 12_345 });
    const result = await waitForTransactionConfirmation(makeTarget(neverResolves), {
      timeoutMs: 30,
      fetchReceipt: () => Promise.resolve(receipt),
    });

    expect(result.state).toBe("confirmed");
    expect(result.reason).toBe("mined_success");
    expect(result.receipt).toBe(receipt);
    expect(result.receipt!.blockNumber).toBe(12_345);
  });

  test("a receipt found after a wait error is classified from the real receipt", async () => {
    const receipt = makeReceipt({ status: 0 });
    const result = await waitForTransactionConfirmation(
      makeTarget(() => Promise.reject(new Error("provider blew up mid-poll"))),
      { fetchReceipt: () => Promise.resolve(receipt) },
    );

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("mined_reverted");
    expect(result.receipt).toBe(receipt);
  });

  test("a definitively cancelled replacement → failed (never confirmed)", async () => {
    const replacementReceipt = makeReceipt({ hash: REPLACEMENT_HASH, status: 1 });
    const result = await waitForTransactionConfirmation(
      makeTarget(() =>
        Promise.reject(
          Object.assign(new Error("transaction was replaced"), {
            code: "TRANSACTION_REPLACED",
            cancelled: true,
            receipt: replacementReceipt,
          }),
        ),
      ),
      { fetchReceipt: () => Promise.resolve(null) },
    );

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("replacement_cancelled");
    expect(result.txHash).toBe(TX_HASH);
  });

  test("a repriced replacement that mined successfully confirms under the mined hash", async () => {
    const replacementReceipt = makeReceipt({ hash: REPLACEMENT_HASH, status: 1 });
    const result = await waitForTransactionConfirmation(
      makeTarget(() =>
        Promise.reject(
          Object.assign(new Error("transaction was replaced"), {
            code: "TRANSACTION_REPLACED",
            cancelled: false,
            receipt: replacementReceipt,
          }),
        ),
      ),
      { fetchReceipt: () => Promise.resolve(null) },
    );

    expect(result.state).toBe("confirmed");
    expect(result.txHash).toBe(REPLACEMENT_HASH);
    expect(result.receipt).toBe(replacementReceipt);
  });
});

describe("waitForTransactionConfirmation — timer cleanup", () => {
  test("TEST 6: the confirmation timer is cleared after success", async () => {
    const { schedule, handles, cleared } = recordingSchedule();
    const receipt = makeReceipt({ status: 1 });
    const result = await waitForTransactionConfirmation(makeTarget(() => Promise.resolve(receipt)), {
      schedule,
    });

    expect(result.state).toBe("confirmed");
    expect(handles.length).toBe(1);
    expect(cleared.length).toBe(1);
    expect(cleared[0]).toBe(handles[0]);
    expect(handles[0]!.fired).toBe(false);
  });

  test("TEST 7: the confirmation timer is cleared after failure", async () => {
    const { schedule, handles, cleared } = recordingSchedule();
    const receipt = makeReceipt({ status: 0 });
    const result = await waitForTransactionConfirmation(makeTarget(() => Promise.resolve(receipt)), {
      schedule,
    });

    expect(result.state).toBe("failed");
    expect(handles.length).toBe(1);
    expect(cleared.length).toBe(1);
    expect(cleared[0]).toBe(handles[0]);
    expect(handles[0]!.fired).toBe(false);
  });

  test("the confirmation timer is cleared after a timeout as well", async () => {
    const { schedule, handles, cleared } = recordingSchedule();
    const result = await waitForTransactionConfirmation(makeTarget(neverResolves), {
      timeoutMs: 20,
      fetchReceipt: () => Promise.resolve(null),
      schedule,
    });

    expect(result.state).toBe("pending");
    expect(handles.length).toBe(1);
    expect(cleared.length).toBe(1);
    expect(handles[0]!.fired).toBe(true);
  });
});

describe("submitTransactionAndConfirm", () => {
  test("TEST 4: submission throws → failed / submission_error (no tx hash)", async () => {
    const submissionError = new Error("user rejected the transaction");
    const result = await submitTransactionAndConfirm(() => Promise.reject(submissionError));

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("submission_error");
    expect(result.txHash).toBeNull();
    expect(result.receipt).toBeNull();
    expect((result as { error?: unknown }).error).toBe(submissionError);
  });

  test("a submission that yields no transaction hash → failed / submission_error", async () => {
    const result = await submitTransactionAndConfirm(() =>
      Promise.resolve({ hash: "" } as unknown as ConfirmationTarget),
    );

    expect(result.state).toBe("failed");
    expect(result.reason).toBe("submission_error");
    expect(result.txHash).toBeNull();
  });

  test("submitted + confirmed: onSubmitted fires before the wait and the result confirms", async () => {
    const receipt = makeReceipt({ status: 1 });
    const observed: string[] = [];
    const result = await submitTransactionAndConfirm(
      () => Promise.resolve(makeTarget(() => Promise.resolve(receipt))),
      {
        onSubmitted: (tx) => observed.push(tx.hash),
      },
    );

    expect(observed).toEqual([TX_HASH]);
    expect(result.state).toBe("confirmed");
    expect(result.txHash).toBe(TX_HASH);
    expect(result.receipt).toBe(receipt);
  });

  test("submitted + pending: onSubmitted fires and the hash survives the timeout", async () => {
    const observed: string[] = [];
    const result = await submitTransactionAndConfirm(
      () => Promise.resolve(makeTarget(neverResolves)),
      {
        timeoutMs: 30,
        fetchReceipt: () => Promise.resolve(null),
        onSubmitted: (tx) => observed.push(tx.hash),
      },
    );

    expect(observed).toEqual([TX_HASH]);
    expect(result.state).toBe("pending");
    expect(result.txHash).toBe(TX_HASH);
    expect(result.state).not.toBe("confirmed");
  });
});

describe("getTransactionState — one-shot re-check (no polling)", () => {
  test("a real mined receipt with status 1 → confirmed", async () => {
    const receipt = makeReceipt({ status: 1, blockNumber: 99 });
    const check = await getTransactionState(TX_HASH, () => Promise.resolve(receipt));
    expect(check.state).toBe("confirmed");
    expect(check.receipt).toBe(receipt);
  });

  test("a real mined receipt with status 0 → failed", async () => {
    const receipt = makeReceipt({ status: 0 });
    const check = await getTransactionState(TX_HASH, () => Promise.resolve(receipt));
    expect(check.state).toBe("failed");
  });

  test("no receipt yet → pending (never success)", async () => {
    const check = await getTransactionState(TX_HASH, () => Promise.resolve(null));
    expect(check.state).toBe("pending");
    expect(check.receipt).toBeNull();
  });

  test("an RPC error during the re-check → pending/unknown (never success)", async () => {
    const check = await getTransactionState(TX_HASH, () => Promise.reject(new Error("rpc down")));
    expect(check.state).toBe("pending");
    expect(check.receipt).toBeNull();
  });

  test("a synthetic blockNumber: 0 receipt from the RPC path → pending", async () => {
    const synthetic = makeReceipt({ blockNumber: 0, status: 1 });
    const check = await getTransactionState(TX_HASH, () => Promise.resolve(synthetic));
    expect(check.state).toBe("pending");
  });
});

describe("pending transaction registry", () => {
  test("records an issuance and preserves its tx hash and payload", () => {
    recordPendingTransaction({
      kind: "issuance",
      txHash: TX_HASH,
      certificateId: "CERT-2026-999999",
      fingerprint: `0x${"1f".repeat(32)}`,
      ipfsCid: "QmTestCid",
      issuerWallet: "0x3e72b00000000000000000000000000000007bC01",
      input: {
        recipientName: "Pending Recipient",
        recipientEmail: "pending@example.edu",
        course: "Pending Course",
        type: "Completion",
        issueDate: "2026-10-15",
      },
      submittedAt: new Date().toISOString(),
    });

    const record = getPendingTransaction(TX_HASH);
    expect(record).not.toBeNull();
    expect(record!.txHash).toBe(TX_HASH);
    expect(record!.kind).toBe("issuance");
    expect(listPendingTransactions().length).toBe(1);
  });

  test("records a revocation and removes it after a definitive re-check", () => {
    recordPendingTransaction({
      kind: "revocation",
      txHash: TX_HASH,
      certificateId: "CERT-2026-111111",
      submittedAt: new Date().toISOString(),
    });
    expect(getPendingTransaction(TX_HASH)).not.toBeNull();

    removePendingTransaction(TX_HASH);
    expect(getPendingTransaction(TX_HASH)).toBeNull();
    expect(listPendingTransactions().length).toBe(0);
  });

  test("reset clears all pending records", () => {
    recordPendingTransaction({
      kind: "revocation",
      txHash: TX_HASH,
      certificateId: "CERT-2026-222222",
      submittedAt: new Date().toISOString(),
    });
    resetPendingTransactions();
    expect(listPendingTransactions().length).toBe(0);
  });
});
