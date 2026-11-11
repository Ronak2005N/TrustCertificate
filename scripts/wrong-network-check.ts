/**
 * wrong-network-check.ts — Task 10 verification of the wrong-network guards.
 *
 * ZERO transactions are sent and NO funds are spent. An EIP-1193 shim
 * pretends MetaMask is connected to Ethereum mainnet (chainId 0x1) instead of
 * Polygon Amoy, then calls the REAL issueCertificate() and
 * revokeCertificate() application functions. The expected behavior:
 *
 *   - both refuse with a typed `wrong_network` error,
 *   - the refusal happens BEFORE any IPFS upload, transaction signing, or
 *     transaction submission (the shim records every RPC method it receives;
 *     no eth_sendTransaction / signing call may appear),
 *   - the issuance failure record shows transactionSubmitted=false and no
 *     transaction hash (pending-never-success invariant preserved).
 *
 * The IPFS server-function context is deliberately NOT seeded: if the guard
 * failed and execution reached the IPFS stage, the error category would be
 * ipfs_failed (or worse — a pin attempt), never wrong_network.
 *
 * Run:
 *   bun scripts/wrong-network-check.ts
 *
 * Prints no secrets.
 */
import {
  issueCertificate,
  revokeCertificate,
} from "../src/lib/certificates";
import { getLastIssuanceFailure } from "../src/lib/issuance-timing";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`[wrong-network] ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/**
 * Minimal EIP-1193 shim reporting Ethereum mainnet. Every requested RPC
 * method is recorded so the check can prove no signing/submission occurred.
 */
function createWrongChainShim(recordedCalls: string[]) {
  return {
    isMetaMask: true,
    request: async ({ method }: { method: string; params?: unknown[] }) => {
      recordedCalls.push(method);
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return ["0x0000000000000000000000000000000000000001"];
        case "eth_chainId":
          return "0x1"; // Ethereum mainnet — WRONG
        case "net_version":
          return "1";
        case "eth_sendTransaction":
          throw new Error("eth_sendTransaction must never be reached on the wrong network");
        default:
          throw new Error(`unexpected RPC method on wrong-network path: ${method}`);
      }
    },
    on: () => undefined,
    removeListener: () => undefined,
  };
}

async function main(): Promise<void> {
  console.log("[wrong-network] CertiProof Task-10 wrong-network guard check — NO transactions, NO funds spent");

  // --- Guard 1: issueCertificate refuses before any side effect ---
  const issueCalls: string[] = [];
  (globalThis as Record<string, unknown>)["window"] = {
    ethereum: createWrongChainShim(issueCalls),
  };
  let issueError: unknown = null;
  try {
    await issueCertificate({
      recipientName: "Wrong Network Probe",
      recipientEmail: "probe@example.edu",
      course: "Wrong Network Course",
      type: "Completion",
      issueDate: new Date().toISOString().slice(0, 10),
    });
    check("issueCertificate refuses on wrong network", false, "resolved instead of throwing");
  } catch (err) {
    issueError = err;
  }
  const typed = issueError as { type?: string; message?: string } | null;
  check("issueCertificate throws typed wrong_network", typed?.type === "wrong_network", `type=${typed?.type}`);
  check(
    "no transaction signing/submission RPC was made",
    !issueCalls.includes("eth_sendTransaction"),
    `rpc methods seen: ${issueCalls.join(", ") || "(none)"}`,
  );
  const failure = getLastIssuanceFailure();
  check("failure record: transactionSubmitted === false", failure?.transactionSubmitted === false);
  check("failure record: transactionHash === null", failure?.transactionHash === null);
  check("failure record: errorCategory === wrong_network", failure?.errorCategory === "wrong_network", `category=${failure?.errorCategory}`);

  // --- Guard 2: revokeCertificate refuses before any side effect ---
  const revokeCalls: string[] = [];
  (globalThis as Record<string, unknown>)["window"] = {
    ethereum: createWrongChainShim(revokeCalls),
  };
  let revokeError: unknown = null;
  try {
    await revokeCertificate("CERT-2026-000000");
    check("revokeCertificate refuses on wrong network", false, "resolved instead of throwing");
  } catch (err) {
    revokeError = err;
  }
  const revokeTyped = revokeError as { type?: string } | null;
  check("revokeCertificate throws typed wrong_network", revokeTyped?.type === "wrong_network", `type=${revokeTyped?.type}`);
  check(
    "no transaction signing/submission RPC was made (revoke)",
    !revokeCalls.includes("eth_sendTransaction"),
    `rpc methods seen: ${revokeCalls.join(", ") || "(none)"}`,
  );

  if (failures > 0) {
    console.error(`[wrong-network] ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("[wrong-network] all checks PASSED");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[wrong-network] fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
