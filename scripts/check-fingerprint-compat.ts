/**
 * Read-only compatibility check for the certificate fingerprint protocol.
 *
 * Recomputes the metadata fingerprint for every Supabase certificate record
 * using the production canonicalization (src/lib/certificate-fingerprint.ts)
 * and compares it with:
 *   1. the certificate_hash stored in Supabase, and
 *   2. the fingerprint anchored on-chain (when the RPC is reachable).
 *
 * Run: bun scripts/check-fingerprint-compat.ts
 *
 * SAFETY: read-only; makes no writes and prints no secrets.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { generateCertificateFingerprint } from "../src/lib/certificate-fingerprint";

config();

const RPC_URL = "https://polygon-amoy-bor-rpc.publicnode.com";
const CONTRACT_ADDRESS = "0x09921D25cB513793e17082Cce0fB4F520f0CDF50";
const ABI = [
  "function getCertificate(string certificateId) view returns (bytes32 certificateHash, address issuerAddress, string ipfsCID, string certificateNumber, uint256 issueTimestamp, uint256 status)",
];

interface CertificateRow {
  certificate_id: string;
  recipient_name: string;
  course: string;
  issue_date: string;
  certificate_hash: string;
}

async function main() {
  const supabaseUrl = process.env["VITE_SUPABASE_URL"];
  const supabaseKey = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the environment.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("certificates")
    .select("certificate_id, recipient_name, course, issue_date, certificate_hash")
    .order("certificate_id", { ascending: true });

  if (error || !data) {
    console.error("Supabase query failed:", error?.message ?? "no data");
    process.exit(1);
  }

  const rows = data as CertificateRow[];
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  let storedMatches = 0;
  let chainMatches = 0;
  let chainChecked = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const recomputed = await generateCertificateFingerprint({
      certificateId: row.certificate_id,
      recipientName: row.recipient_name,
      course: row.course,
      issueDate: row.issue_date,
    });

    const storedOk = recomputed === row.certificate_hash.toLowerCase();
    if (storedOk) storedMatches++;
    else failures.push(`${row.certificate_id}: recomputed != stored certificate_hash`);

    let chainNote = "chain: not registered / RPC error";
    try {
      const result = await contract.getCertificate(row.certificate_id);
      const onChainHash = (result[0] as string).toLowerCase();
      chainChecked++;
      const chainOk = recomputed === onChainHash;
      if (chainOk) chainMatches++;
      else failures.push(`${row.certificate_id}: recomputed != on-chain fingerprint`);
      chainNote = `chain: ${chainOk ? "MATCH" : "MISMATCH"}`;
    } catch {
      // certificate missing on-chain or RPC unreachable
    }

    console.log(
      `${row.certificate_id} | stored: ${storedOk ? "MATCH" : "MISMATCH"} | ${chainNote}`,
    );
  }

  console.log("");
  console.log(`records checked: ${rows.length}`);
  console.log(`stored hash matches: ${storedMatches}/${rows.length}`);
  console.log(`on-chain matches: ${chainMatches}/${chainChecked}`);

  if (failures.length > 0) {
    console.log("FAILURES:");
    for (const failure of failures) console.log(`  ${failure}`);
    process.exitCode = 1;
  }
}

void main();
