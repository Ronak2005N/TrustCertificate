/**
 * live-method-c-check.ts — Task 8 live verification for Method C (read-only).
 *
 * Generates certificate PDFs with the application's own generator using the
 * AUTHENTIC metadata of a real Supabase-backed registry certificate, then
 * runs the application's analyzeDocument() against Polygon Amoy + Supabase:
 *
 *   A. original certificate                    → expect match
 *   B. recipient name modified                 → expect mismatch
 *   C. course modified                         → expect mismatch
 *   D. issue date modified                     → expect mismatch
 *   E. certificate ID modified (unknown ID)    → expect not_found
 *
 * Sends no transactions, writes nothing, uploads nothing to IPFS.
 *
 * Run: bun scripts/live-method-c-check.ts
 */

import {
  analyzeDocument,
  fetchAllCertificatesFromSupabase,
  fetchCertificateFromChain,
} from "../src/lib/certificates";
import { generateCertificateBlob } from "../src/lib/pdf/generate-certificate";

interface Scenario {
  name: string;
  expected: "match" | "mismatch" | "not_found";
  overrides: { id?: string; recipientName?: string; course?: string; issueDate?: string };
}

async function main(): Promise<void> {
  console.log("[live-method-c] selecting a real active Supabase-backed certificate...");

  const supabaseCerts = await fetchAllCertificatesFromSupabase();
  const active = supabaseCerts.filter((c) => c.status === "active" && /^CERT-\d{4}-\d{4,6}$/.test(c.id));
  if (active.length === 0) throw new Error("no active Supabase-backed certificates available");
  const target = active[0]!;

  const chainCert = await fetchCertificateFromChain(target.id);
  if (!chainCert) throw new Error(`certificate ${target.id} not found on chain`);
  if (chainCert.hash.toLowerCase() !== target.hash.toLowerCase()) {
    throw new Error(`chain/Supabase hash mismatch for ${target.id} — refusing ambiguous target`);
  }
  console.log(
    `[live-method-c] target: ${target.id} | recipient="${target.recipientName}" | course="${target.course}" | issueDate="${target.issueDate}"`,
  );

  const scenarios: Scenario[] = [
    { name: "A. original certificate", expected: "match", overrides: {} },
    {
      name: "B. recipient name modified",
      expected: "mismatch",
      overrides: { recipientName: "Wrong Recipient" },
    },
    { name: "C. course modified", expected: "mismatch", overrides: { course: "Wrong Course" } },
    { name: "D. issue date modified", expected: "mismatch", overrides: { issueDate: "2026-01-01" } },
    {
      name: "E. certificate ID modified (unknown ID)",
      expected: "not_found",
      overrides: { id: "CERT-2099-999999" },
    },
  ];

  let failures = 0;
  for (const s of scenarios) {
    const blob = await generateCertificateBlob({
      id: s.overrides.id ?? target.id,
      recipientName: s.overrides.recipientName ?? target.recipientName,
      course: s.overrides.course ?? target.course,
      organization: "CertiProof Live Check",
      issueDate: s.overrides.issueDate ?? target.issueDate,
      certificateNumber: s.overrides.id ?? target.id,
    });
    const file = new File([new Uint8Array(await blob.arrayBuffer())], "live-check.pdf", {
      type: "application/pdf",
    });
    const t0 = performance.now();
    const result = await analyzeDocument(file);
    const ms = Math.round(performance.now() - t0);
    const ok = result.outcome === s.expected;
    if (!ok) failures++;
    console.log(
      `[live-method-c] ${s.name}: outcome=${result.outcome} expected=${s.expected} ${ok ? "PASS" : "FAIL"} (${ms} ms)`,
    );
    if (ok && result.outcome === "match") {
      for (const f of result.fields) {
        console.log(`    ${f.label}: match=${f.match}`);
      }
    }
    if (!ok) {
      for (const f of result.fields) {
        console.log(`    ${f.label}: document="${f.document}" registry="${f.registry}" match=${f.match}`);
      }
    }
  }

  if (failures > 0) {
    console.error(`[live-method-c] ${failures} scenario(s) FAILED`);
    process.exit(1);
  }
  console.log("[live-method-c] all 5 scenarios PASSED");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[live-method-c] fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
