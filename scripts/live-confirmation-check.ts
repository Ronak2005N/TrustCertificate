/**
 * live-confirmation-check.ts — live verification of the confirmation state machine.
 *
 * TESTNET ONLY: Polygon Amoy (chainId 80002).
 *
 * Sends ONE real 0-value self-transfer from the issuer wallet and drives it
 * through waitForTransactionConfirmation with a tiny timeout so the pending
 * path is exercised on a genuine in-flight transaction (the timeout case the
 * bench previously faked). It then re-checks the same tx hash with bounded
 * one-shot polls (getTransactionState — the same primitive used by the app's
 * pending-status re-check) until a definitive receipt arrives, verifying:
 *
 *   1. pending is reported while the tx is unmined (NEVER success),
 *   2. the tx hash survives the timeout,
 *   3. the tx eventually reaches confirmed with a real blockNumber > 0.
 *
 * Run:
 *   bun scripts/live-confirmation-check.ts
 *
 * Total cost: one low-gas self-transfer in test POL. No private keys, no
 * secrets, and no raw env values are printed.
 */
import { ethers } from "ethers";
import {
  getTransactionState,
  waitForTransactionConfirmation,
  type TransactionConfirmation,
  type TransactionStateCheck,
} from "../src/lib/blockchain/confirmation";
import { POLYGON_AMOY } from "../src/lib/blockchain/contracts";

function abort(message: string): never {
  console.error(`[live-check] ABORT: ${message}`);
  process.exit(1);
}

function describeConfirmation(result: TransactionConfirmation): string {
  return `state=${result.state} reason=${result.reason} txHash=${result.txHash ?? "null"} blockNumber=${result.receipt ? String(result.receipt.blockNumber) : "null"}`;
}

async function main(): Promise<void> {
  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) abort("DEPLOYER_PRIVATE_KEY is not set in .env");

  const provider = new ethers.JsonRpcProvider(POLYGON_AMOY.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("[live-check] CertiProof confirmation live check — Polygon Amoy TESTNET (chainId 80002)");
  console.log(`[live-check] wallet: ${wallet.address}`);

  // --- Preflight: chain identity + funded wallet ---
  const network = await provider.getNetwork().catch(() => null);
  if (!network || network.chainId !== BigInt(POLYGON_AMOY.chainId)) {
    abort(`RPC did not report chainId ${POLYGON_AMOY.chainId} (got ${network ? network.chainId.toString() : "unreachable"})`);
  }
  const balance = await provider.getBalance(wallet.address).catch(() => null);
  if (balance === null) abort("could not read wallet balance");
  if (balance === 0n) abort("issuer wallet has zero POL — fund it from https://faucet.polygon.technology");
  console.log(`[live-check] chainId ${POLYGON_AMOY.chainId} ok, balance ${ethers.formatEther(balance)} POL`);

  // --- Step 1: one real self-transfer, confirmed with a tiny timeout ---
  console.log("[live-check] sending 0-value self-transfer …");
  const tx = await wallet.sendTransaction({ to: wallet.address, value: 0 });
  console.log(`[live-check] submitted: ${tx.hash}`);

  const TINY_TIMEOUT_MS = 1;
  const pendingResult = await waitForTransactionConfirmation(tx, {
    timeoutMs: TINY_TIMEOUT_MS,
    fetchReceipt: (txHash) => provider.getTransactionReceipt(txHash).catch(() => null),
  });
  console.log(`[live-check] tiny-timeout wait → ${describeConfirmation(pendingResult)}`);

  if (pendingResult.state === "confirmed") {
    // The tx mined within the 1ms timeout window — the state machine still
    // behaved correctly (receipt-based confirmation). Re-run to sample again
    // if a pending result is specifically needed.
    console.log("[live-check] NOTE: tx mined within the tiny timeout window; confirmed path exercised on-chain.");
  } else if (pendingResult.state === "failed") {
    abort(`tiny-timeout wait unexpectedly reported failed (${pendingResult.reason}) for a plain self-transfer`);
  }

  if (pendingResult.txHash !== tx.hash) {
    abort(`tx hash was not preserved across the timeout (expected ${tx.hash}, got ${pendingResult.txHash ?? "null"})`);
  }
  if (pendingResult.receipt !== null) {
    abort("pending confirmation unexpectedly carried a receipt");
  }
  console.log("[live-check] OK: timeout produced pending (never success) and preserved the tx hash");

  // --- Step 2: bounded one-shot re-checks until a definitive receipt ---
  console.log("[live-check] polling with one-shot getTransactionState until mined …");
  const POLL_INTERVAL_MS = 5_000;
  const DEADLINE_MS = 180_000;
  const startedAt = Date.now();
  let finalResult: TransactionStateCheck | null = null;

  for (;;) {
    const check = await getTransactionState(tx.hash, (txHash) =>
      provider.getTransactionReceipt(txHash).catch(() => null),
    );
    console.log(`[live-check] t+${((Date.now() - startedAt) / 1000).toFixed(1)}s → ${check.state}${check.receipt ? ` (block ${check.receipt.blockNumber})` : ""}`);
    if (check.state !== "pending") {
      finalResult = check;
      break;
    }
    if (Date.now() - startedAt >= DEADLINE_MS) {
      abort("transaction still unmined after 180s — investigate the RPC/mempool");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.log(
    `[live-check] final → state=${finalResult.state} txHash=${tx.hash} blockNumber=${finalResult.receipt.blockNumber}`,
  );
  if (finalResult.state !== "confirmed") {
    abort(`self-transfer ended ${finalResult.state} — expected confirmed`);
  }
  if (!finalResult.receipt || finalResult.receipt.blockNumber <= 0 || finalResult.receipt.status !== 1) {
    abort("confirmed result did not carry a real successful receipt (blockNumber > 0, status 1)");
  }

  console.log(
    `[live-check] PASS: pending → confirmed on block ${finalResult.receipt.blockNumber} after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[live-check] unexpected error: ${message}`);
  process.exit(1);
});
