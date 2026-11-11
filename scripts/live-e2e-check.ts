/**
 * live-e2e-check.ts — Task 10 read-only end-to-end verification.
 *
 * TESTNET ONLY: Polygon Amoy (chainId 80002). Sends no transactions and
 * writes nothing to chain, IPFS, or Supabase.
 *
 * Given a real issued certificate id (optionally its IPFS CID and tx hash),
 * verifies:
 *
 *   Phase 2 evidence: on-chain receipt (status 1, blockNumber > 0), CID and
 *   fingerprint preserved on-chain.
 *
 *   Phase 3: Method A (verifyCertificate), Method B (QR payload → extract →
 *   verifyCertificate, must be consistent with A), Method C (authentic
 *   regenerated PDF → analyzeDocument → match), incl. issuer authorization
 *   and IPFS-document checks.
 *
 *   Phase 4: tampering on COPIES ONLY — recipient, course, date, unknown ID,
 *   malformed PDF, empty file. No false verified result and no crash allowed.
 *
 *   Phase 5: Supabase integrity — anchored row usable via
 *   fetchVerifiedCertificateFromSupabase, unknown id rejected, live-row
 *   reconciliation against the chain, and the documented RPC-error fail-open
 *   behavior demonstrated on live data.
 *
 * Run:
 *   bun scripts/live-e2e-check.ts CERT-2026-NNNNNN [--cid=Qm…] [--tx=0x…]
 *
 * Prints no secrets.
 */
import { ethers } from "ethers";
import {
  analyzeDocument,
  fetchAllCertificatesFromSupabase,
  fetchCertificateFromChain,
  fetchCertificateFromSupabase,
  fetchVerifiedCertificateFromSupabase,
  reconcileSupabaseRowsWithChain,
  verifyCertificate,
  type ChainLookupResult,
} from "../src/lib/certificates";
import { buildQrPayload, extractHashFromQrPayload } from "./bench-verification";
import { generateCertificateBlob } from "../src/lib/pdf/generate-certificate";

const RPC_URL = "https://polygon-amoy-bor-rpc.publicnode.com";
const CONTRACT_ADDRESS = "0x09921D25cB513793e17082Cce0fB4F520f0CDF50";
const ABI = [
  "function getCertificate(string certificateId) view returns (bytes32 certificateHash, address issuerAddress, string ipfsCID, string certificateNumber, uint256 issueTimestamp, uint256 status)",
  "function isAuthorizedIssuer(address wallet) view returns (bool)",
];

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`[e2e] ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function arg(flag: string): string | null {
  const a = process.argv.find((x) => x.startsWith(`--${flag}=`));
  return a ? a.slice(flag.length + 3) : null;
}

/** Mirrors the application's lookupOnChainCertificateRecord semantics (app-internal, not exported). */
function makeChainLookup(provider: ethers.JsonRpcProvider, contract: ethers.Contract) {
  return async (certId: string): Promise<ChainLookupResult> => {
    try {
      const result = await contract.getCertificate(certId);
      const hash = result[0] as string;
      if (!hash || /^0x0{64}$/i.test(hash)) return { state: "missing" };
      return {
        state: "found",
        record: { hash, status: Number(result[5]) === 0 ? "active" : "revoked" },
      };
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      return code === "CALL_EXCEPTION" ? { state: "missing" } : { state: "error" };
    }
  };
}

async function main(): Promise<void> {
  const certId = process.argv[2];
  if (!certId || certId.startsWith("--")) {
    console.error("Usage: bun scripts/live-e2e-check.ts CERT-2026-NNNNNN [--cid=Qm…] [--tx=0x…]");
    process.exit(1);
  }
  const expectedCid = arg("cid");
  const expectedTx = arg("tx");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  console.log(`[e2e] CertiProof Task-10 live E2E check — READ-ONLY — target ${certId}`);

  // --- Preflight: chain identity ---
  const network = await provider.getNetwork().catch(() => null);
  check("RPC reports Polygon Amoy chainId 80002", network?.chainId === BigInt(80002));

  // --- Phase 2 evidence: receipt + preserved CID/fingerprint ---
  const chainCert = await fetchCertificateFromChain(certId);
  check("chain record exists", chainCert !== null);
  if (!chainCert) {
    console.error("[e2e] aborting — no on-chain record for the target certificate");
    process.exit(1);
  }

  const raw = await contract.getCertificate(certId);
  const onChainCid = raw[2] as string;
  const issuer = raw[1] as string;
  check("on-chain fingerprint preserved (0x + 64 hex)", /^0x[0-9a-fA-F]{64}$/.test(chainCert.hash));
  check(
    "on-chain IPFS CID preserved",
    onChainCid.length > 0 && (!expectedCid || onChainCid === expectedCid),
    expectedCid ? "matches issuance CID" : "non-empty",
  );
  if (expectedTx) {
    const receipt = await provider.getTransactionReceipt(expectedTx);
    check("issuance receipt status === 1", receipt?.status === 1);
    check("issuance receipt blockNumber > 0", (receipt?.blockNumber ?? 0) > 0, `block #${receipt?.blockNumber}`);
    // The app's event scan (fromBlock 0) is capped at a 10k-block range by
    // the public RPC, so tx-hash recovery falls back to receipt verification:
    // the receipt must contain a CertificateRegistered log for this id.
    const iface = new ethers.Interface([
      "event CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)",
    ]);
    const topic0 = iface.getEvent("CertificateRegistered")!.topicHash;
    const topic1 = ethers.id(certId);
    const registrationLog = receipt?.logs.some(
      (log) =>
        log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() &&
        log.topics[0] === topic0 &&
        log.topics[1] === topic1,
    );
    check(
      "registration tx hash verified via on-chain receipt log",
      registrationLog === true,
      "tx anchored to a CertificateRegistered event",
    );
    if (!chainCert.chain.transactionHash) {
      console.log(
        "[e2e] OBSERVATION: direct event-scan tx recovery empty on this RPC (10k-block eth_getLogs cap) — pre-existing, also seen in Task-6 benchmark (0/10); receipt-verified fallback now restores it in Method A and the certificate detail page",
      );
    }
  }
  const authorized = await contract.isAuthorizedIssuer(issuer).catch(() => null);
  check("issuer authorization passes on-chain", authorized === true, issuer);

  // --- Phase 3: Methods A / B / C on the SAME certificate ---
  const a = await verifyCertificate(chainCert.hash);
  check("Method A outcome === verified", a.outcome === "verified", `outcome=${a.outcome}`);
  for (const c of a.checks) {
    check(`Method A check: ${c.label}`, c.pass, c.value);
  }
  const aBlockchain = a.checks.find((c) => c.label === "Blockchain Record");
  check(
    "Method A resolved a REAL registration block via receipt-verified fallback",
    typeof aBlockchain?.value === "string" && aBlockchain.value.startsWith("BLOCK #") && aBlockchain.value !== "BLOCK #0",
    aBlockchain?.value,
  );

  const qrPayload = buildQrPayload(chainCert.hash);
  const extractedHash = extractHashFromQrPayload(qrPayload);
  const b = await verifyCertificate(extractedHash ?? "");
  check("Method B outcome === verified", b.outcome === "verified", `outcome=${b.outcome}`);
  check(
    "Method B consistent with Method A",
    b.outcome === a.outcome && b.certificate?.id === a.certificate?.id,
  );

  const row = await fetchCertificateFromSupabase(certId);
  check("Supabase row exists for the certificate", row !== null);
  if (row) {
    const authenticPdf = await generateCertificateBlob({
      id: certId,
      recipientName: row.recipientName,
      course: row.course,
      organization: row.organization,
      issueDate: row.issueDate,
      certificateNumber: certId,
    });
    const file = new File([new Uint8Array(await authenticPdf.arrayBuffer())], "authentic.pdf", {
      type: "application/pdf",
    });
    const c = await analyzeDocument(file);
    check("Method C outcome === match", c.outcome === "match", `outcome=${c.outcome}`);
    check(
      "Method C fingerprint matches chain",
      c.fields.find((f) => f.label === "Certificate fingerprint")?.match === true,
    );
    check(
      "Method C document metadata fingerprint matches chain",
      c.fields.find((f) => f.label === "Document metadata fingerprint")?.match === true,
    );
    check("Method C reports chain status (active)", c.certificate?.status === "active", `status=${c.certificate?.status}`);

    // --- Phase 4: tampering on COPIES ONLY ---
    const tamperPdf = async (overrides: { id?: string; recipientName?: string; course?: string; issueDate?: string }) => {
      const blob = await generateCertificateBlob({
        id: overrides.id ?? certId,
        recipientName: overrides.recipientName ?? row.recipientName,
        course: overrides.course ?? row.course,
        organization: row.organization,
        issueDate: overrides.issueDate ?? row.issueDate,
        certificateNumber: overrides.id ?? certId,
      });
      return new File([new Uint8Array(await blob.arrayBuffer())], "tampered.pdf", { type: "application/pdf" });
    };

    const tRecipient = await analyzeDocument(await tamperPdf({ recipientName: "Wrong Recipient" }));
    check("tampered recipient → mismatch", tRecipient.outcome === "mismatch", `outcome=${tRecipient.outcome}`);
    const tCourse = await analyzeDocument(await tamperPdf({ course: "Wrong Course" }));
    check("tampered course → mismatch", tCourse.outcome === "mismatch", `outcome=${tCourse.outcome}`);
    const tDate = await analyzeDocument(await tamperPdf({ issueDate: "2026-01-01" }));
    check("tampered date → mismatch", tDate.outcome === "mismatch", `outcome=${tDate.outcome}`);
    const tId = await analyzeDocument(await tamperPdf({ id: "CERT-2099-999999" }));
    check("tampered/unknown certificate ID → not_found", tId.outcome === "not_found", `outcome=${tId.outcome}`);

    const garbage = new Uint8Array(512);
    for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) % 256;
    const tMalformed = await analyzeDocument(new File([garbage], "malformed.pdf", { type: "application/pdf" }));
    check("malformed PDF → safe not_found (no crash)", tMalformed.outcome === "not_found", `outcome=${tMalformed.outcome}`);
    const tEmpty = await analyzeDocument(new File([], "empty.pdf", { type: "application/pdf" }));
    check("empty file → safe not_found (no crash)", tEmpty.outcome === "not_found", `outcome=${tEmpty.outcome}`);
  }

  // --- Phase 5: Supabase integrity on live data ---
  const verified = await fetchVerifiedCertificateFromSupabase(certId);
  check("anchored row → verified detail fetch usable", verified !== null);
  if (verified && row) {
    check("verified detail: hash from chain", verified.hash.toLowerCase() === chainCert.hash.toLowerCase());
    check("verified detail: status from chain", verified.status === chainCert.status, `status=${verified.status}`);
    check("verified detail: metadata usable (recipient present)", verified.recipientName === row.recipientName);
    check("verified detail: metadata usable (course present)", verified.course === row.course);
    check(
      "verified detail: registration tx restored via receipt-verified fallback",
      /^0x[0-9a-fA-F]{64}$/.test(verified.chain.transactionHash) && verified.chain.block > 0,
      verified.chain.transactionHash ? `tx=${verified.chain.transactionHash.slice(0, 10)}… block #${verified.chain.block}` : "empty",
    );
  }
  const unknown = await fetchVerifiedCertificateFromSupabase("CERT-2099-999999");
  check("unknown certificate id → rejected (null)", unknown === null);

  const rows = await fetchAllCertificatesFromSupabase();
  const lookup = makeChainLookup(provider, contract);
  const reconciled = await reconcileSupabaseRowsWithChain(rows, lookup);
  const dropped = rows.length - reconciled.length;
  console.log(`[e2e] live reconciliation: ${rows.length} Supabase rows → ${reconciled.length} chain-anchored (${dropped} dropped)`);
  check("target certificate survives reconciliation", reconciled.some((c) => c.id === certId));

  let statusesFromChain = true;
  for (const c of reconciled) {
    const chain = await lookup(c.id);
    if (chain.state !== "found" || chain.record.status !== c.status) statusesFromChain = false;
  }
  check("reconciled status equals chain status for every surviving row", statusesFromChain);

  const failOpen = await reconcileSupabaseRowsWithChain(
    rows,
    async (): Promise<ChainLookupResult> => ({ state: "error" }),
  );
  check(
    "documented fail-open: inconclusive lookup keeps every row unchanged",
    failOpen.length === rows.length,
    `${failOpen.length}/${rows.length} kept`,
  );

  if (failures > 0) {
    console.error(`[e2e] ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("[e2e] all checks PASSED");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[e2e] fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
