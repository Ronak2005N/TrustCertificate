import { afterEach, describe, expect, test } from "bun:test";
import {
  IssuanceTimer,
  getLastIssuanceFailure,
  getLastIssuanceTimings,
  measureStage,
  recordIssuanceFailure,
  recordIssuanceSuccess,
  resetIssuanceTimingState,
  setIssuanceTimingLogger,
  trackNonBlockingStage,
  waitForPendingNonBlockingStages,
} from "../src/lib/issuance-timing";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  resetIssuanceTimingState();
});

describe("IssuanceTimer", () => {
  test("completed stages produce non-negative finite durations", async () => {
    const timer = new IssuanceTimer();
    await measureStage(timer, "fingerprint", () => sleep(5));
    await measureStage(timer, "pdf", () => sleep(5));
    for (const stage of ["fingerprint", "pdf"] as const) {
      const ms = timer.stageMs(stage);
      expect(ms).not.toBeNull();
      expect(ms!).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(ms!)).toBe(true);
    }
  });

  test("total duration is >= the sum of sequential measured stages", async () => {
    const timer = new IssuanceTimer();
    await measureStage(timer, "fingerprint", () => sleep(4));
    await measureStage(timer, "pdf", () => sleep(4));
    await measureStage(timer, "ipfs", () => sleep(4));
    timer.setCertificateId("CERT-TEST-1");
    const timings = timer.success({ transactionHash: "0xabc", cid: "QmTest" });
    const sequentialSum =
      timings.fingerprintGenerationMs + timings.pdfGenerationMs + timings.ipfsUploadMs;
    expect(timings.totalIssuanceMs).toBeGreaterThanOrEqual(sequentialSum);
  });

  test("endStage without startStage throws; startStage twice throws", () => {
    const timer = new IssuanceTimer();
    expect(() => timer.endStage("fingerprint")).toThrow("not started");
    timer.startStage("fingerprint");
    expect(() => timer.startStage("fingerprint")).toThrow("already started");
  });

  test("recordStageDuration rejects negative or non-finite values", () => {
    const timer = new IssuanceTimer();
    expect(() => timer.recordStageDuration("ipfs", -1)).toThrow("Invalid stage duration");
    expect(() => timer.recordStageDuration("ipfs", Number.NaN)).toThrow("Invalid stage duration");
  });

  test("success refuses to finalize while a stage is still open", () => {
    const timer = new IssuanceTimer();
    timer.startStage("ipfs");
    expect(() => timer.success({ transactionHash: "0x1", cid: "QmX" })).toThrow("still open");
  });
});

describe("measureStage", () => {
  test("returns the operation's exact result, unaltered", async () => {
    const timer = new IssuanceTimer();
    const value = { ok: true as const, cid: "QmUnaltered", url: "ipfs://QmUnaltered" };
    const result = await measureStage(timer, "ipfs", async () => value);
    expect(result).toBe(value);
    expect(result.cid).toBe("QmUnaltered");
    expect(timer.stageMs("ipfs")).not.toBeNull();
  });

  test("a throwing operation propagates and still closes the stage", async () => {
    const timer = new IssuanceTimer();
    await expect(
      measureStage(timer, "ipfs", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(timer.stageMs("ipfs")).not.toBeNull();
    // No fake success record exists for this timer.
    expect(timer.timings).toBeNull();
  });
});

describe("failure records", () => {
  test("timer.fail captures stage, category and submission state", () => {
    const timer = new IssuanceTimer();
    timer.setCertificateId("CERT-TEST-2");
    const record = timer.fail({
      failedStage: "blockchainSubmission",
      errorCategory: "insufficient_funds",
      transactionSubmitted: false,
    });
    expect(record.failedStage).toBe("blockchainSubmission");
    expect(record.errorCategory).toBe("insufficient_funds");
    expect(record.transactionSubmitted).toBe(false);
    expect(record.transactionHash).toBeNull();
    expect(record.totalMsUntilFailure).toBeGreaterThanOrEqual(0);
    expect(record.certificateId).toBe("CERT-TEST-2");
  });

  test("module failure state is recorded and does not create a success record", () => {
    const timer = new IssuanceTimer();
    recordIssuanceFailure(timer, {
      failedStage: "ipfs",
      errorCategory: "ipfs_failed",
      transactionSubmitted: false,
    });
    expect(getLastIssuanceFailure()?.failedStage).toBe("ipfs");
    expect(getLastIssuanceTimings()).toBeNull();
  });
});

describe("success records", () => {
  test("recordIssuanceSuccess stores timings and clears prior failure", async () => {
    const failing = new IssuanceTimer();
    recordIssuanceFailure(failing, {
      failedStage: "ipfs",
      errorCategory: "ipfs_failed",
      transactionSubmitted: false,
    });

    const timer = new IssuanceTimer();
    timer.setCertificateId("CERT-TEST-3");
    await measureStage(timer, "fingerprint", () => sleep(2));
    await measureStage(timer, "pdf", () => sleep(2));
    await measureStage(timer, "ipfs", () => sleep(2));
    await measureStage(timer, "blockchainPreparation", () => sleep(2));
    await measureStage(timer, "blockchainSubmission", () => sleep(2));
    await measureStage(timer, "blockchainConfirmation", () => sleep(2));
    const timings = recordIssuanceSuccess(timer, {
      transactionHash: "0xdeadbeef",
      cid: "QmSuccess",
    });

    expect(getLastIssuanceTimings()).toBe(timings);
    expect(getLastIssuanceFailure()).toBeNull();
    expect(timings.certificateId).toBe("CERT-TEST-3");
    expect(timings.transactionHash).toBe("0xdeadbeef");
    expect(timings.cid).toBe("QmSuccess");
    expect(timings.qrGenerationMs).toBeNull();
    expect(timings.supabasePersistenceMs).toBeNull();
    expect(timings.totalIssuanceMs).toBeGreaterThanOrEqual(0);
    for (const key of [
      "fingerprintGenerationMs",
      "pdfGenerationMs",
      "ipfsUploadMs",
      "blockchainPreparationMs",
      "blockchainSubmissionMs",
      "blockchainConfirmationMs",
    ] as const) {
      expect(timings[key]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("non-blocking stage tracking", () => {
  test("records duration when the promise settles and wait resolves", async () => {
    const timer = new IssuanceTimer();
    timer.setCertificateId("CERT-TEST-4");
    recordIssuanceSuccess(timer, { transactionHash: "0x1", cid: "Qm1" });
    trackNonBlockingStage(
      timer,
      "supabasePersistence",
      sleep(10).then(() => undefined),
    );
    await waitForPendingNonBlockingStages();
    const timings = getLastIssuanceTimings()!;
    expect(timings.supabasePersistenceMs).not.toBeNull();
    expect(timings.supabasePersistenceMs!).toBeGreaterThanOrEqual(0);
  });

  test("swallows rejections like the original .catch(() => {}) behavior", async () => {
    const timer = new IssuanceTimer();
    trackNonBlockingStage(
      timer,
      "supabasePersistence",
      Promise.reject(new Error("insert failed")),
    );
    await expect(waitForPendingNonBlockingStages()).resolves.toBeUndefined();
    // Duration is still recorded (the stage settled, unsuccessfully).
    expect(timer.stageMs("supabasePersistence")).not.toBeNull();
  });
});

describe("logger sink", () => {
  test("custom logger receives structured success events without PII", async () => {
    const events: Record<string, unknown>[] = [];
    setIssuanceTimingLogger((payload) => events.push(payload));

    const timer = new IssuanceTimer();
    timer.setCertificateId("CERT-TEST-5");
    await measureStage(timer, "fingerprint", () => sleep(1));
    await measureStage(timer, "pdf", () => sleep(1));
    await measureStage(timer, "ipfs", () => sleep(1));
    await measureStage(timer, "blockchainPreparation", () => sleep(1));
    await measureStage(timer, "blockchainSubmission", () => sleep(1));
    await measureStage(timer, "blockchainConfirmation", () => sleep(1));
    recordIssuanceSuccess(timer, { transactionHash: "0xabc", cid: "QmLog" });

    expect(events.length).toBe(1);
    const event = events[0]!;
    expect(event["event"]).toBe("issuance-success");
    expect(event["certificateId"]).toBe("CERT-TEST-5");
    const serialized = JSON.stringify(events);
    expect(serialized).not.toMatch(/recipientEmail|recipientName|PINATA|private/i);
  });
});
