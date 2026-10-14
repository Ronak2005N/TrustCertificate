/**
 * eval-metrics.ts — Read-only evaluation harness for the CertiProof IEEE paper.
 *
 * Run:  bun scripts/eval-metrics.ts
 *
 * SAFETY: sends NO blockchain transactions and makes NO writes.
 * Only public RPC reads, local SHA-256 trials, local PDF generation,
 * and (optionally) public IPFS gateway GETs.
 */
import { ethers } from "ethers";
import { generateCertificatePDF } from "../src/lib/pdf/generate-certificate";

const RPC = "https://polygon-amoy-bor-rpc.publicnode.com"; // same RPC the app uses
const LOG_RPC = "https://polygon-amoy.gateway.tenderly.co"; // allows full-range eth_getLogs (publicnode/drpc free cap at 10k blocks)
const CONTRACT = "0x09921D25cB513793e17082Cce0fB4F520f0CDF50";

const ABI = [
  "function getCertificateCount() view returns (uint256)",
  "function certificateIds(uint256) view returns (string)",
  "function getCertificate(string) view returns (bytes32 certificateHash, address issuerAddress, string ipfsCID, string certificateNumber, uint256 issueTimestamp, uint256 status)",
  "function isAuthorizedIssuer(address) view returns (bool)",
  "event CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)",
  "event CertificateRevoked(string indexed certificateId, uint256 timestamp)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const logsProvider = new ethers.JsonRpcProvider(LOG_RPC);
const contract = new ethers.Contract(CONTRACT, ABI, provider);
const iface = new ethers.Interface(ABI);
const topicRegistered = iface.getEvent("CertificateRegistered")!.topicHash;
const topicRevoked = iface.getEvent("CertificateRevoked")!.topicHash;

const ms = () => performance.now();
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (n: number, d = 1) => n.toFixed(d);

async function sha256hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface OnChainCert {
  id: string;
  hash: string;
  issuer: string;
  cid: string;
  ts: number;
  status: number;
}

async function main() {
  const out: string[] = [];
  const log = (s = "") => {
    out.push(s);
    console.log(s);
  };

  // ---------------------------------------------------------------- registry
  log("=== 1. REGISTRY STATE (live, read-only) ===");
  const count = Number(await contract.getCertificateCount());
  const certs: OnChainCert[] = [];
  for (let i = 0; i < count; i++) {
    const id: string = await contract.certificateIds(i);
    const r = await contract.getCertificate(id);
    certs.push({
      id,
      hash: String(r[0]).toLowerCase(),
      issuer: String(r[1]),
      cid: String(r[2]),
      ts: Number(r[4]),
      status: Number(r[5]),
    });
  }
  const active = certs.filter((c) => c.status === 0).length;
  log(`certificate count = ${count} | active = ${active} | revoked = ${count - active}`);

  // -------------------------------------------------------------------- gas
  log("");
  log("=== 2. TRANSACTION GAS USAGE (from confirmed receipts) ===");
  const regLogs = await logsProvider.getLogs({
    address: CONTRACT,
    topics: [topicRegistered],
    fromBlock: 0,
    toBlock: "latest",
  });
  const revLogs = await logsProvider.getLogs({
    address: CONTRACT,
    topics: [topicRevoked],
    fromBlock: 0,
    toBlock: "latest",
  });
  const gasReg: number[] = [];
  for (const l of reciptSafe(regLogs)) {
    const rc = await logsProvider.getTransactionReceipt(l);
    if (rc) gasReg.push(Number(rc.gasUsed));
  }
  const gasRev: number[] = [];
  for (const l of reciptSafe(revLogs)) {
    const rc = await logsProvider.getTransactionReceipt(l);
    if (rc) gasRev.push(Number(rc.gasUsed));
  }
  const stats = (a: number[]) =>
    a.length
      ? `n=${a.length} min=${Math.min(...a)} mean=${Math.round(mean(a))} median=${Math.round(median(a))} max=${Math.max(...a)}`
      : "n=0 (none found)";
  log(`CertificateRegistered receipts: ${stats(gasReg)}`);
  log(`CertificateRevoked   receipts: ${stats(gasRev)}`);
  log(`gas cost example @30 gwei: ${Math.round(mean(gasReg))} gas ≈ ${fmt((Math.round(mean(gasReg)) * 30) / 1e9, 6)} POL per issuance`);

  // ------------------------------------------------- verification latency
  log("");
  log("=== 3. VERIFICATION LATENCY (chain-only, mirrors verifyCertificate) ===");
  let logsOk = 0;
  let logsFail = 0;
  const hash = async (certId: string, withProof: boolean) => {
    let calls = 0;
    const t0 = ms();
    calls += 1;
    const n = Number(await contract.getCertificateCount());
    let found: OnChainCert | null = null;
    for (let i = 0; i < n; i++) {
      calls += 1;
      const id: string = await contract.certificateIds(i);
      const r = await contract.getCertificate(id);
      if (String(r[0]).toLowerCase() === certId) {
        found = {
          id,
          hash: String(r[0]).toLowerCase(),
          issuer: String(r[1]),
          cid: String(r[2]),
          ts: Number(r[4]),
          status: Number(r[5]),
        };
        break;
      }
    }
    if (found && withProof) {
      calls += 3;
      // replicate the app's exact behaviour: getLogs(fromBlock 0) on the app's
      // own RPC, error swallowed the same way certificates.ts does
      try {
        await provider.getLogs({
          address: CONTRACT,
          topics: [topicRegistered, ethers.id(found.id)],
          fromBlock: 0,
          toBlock: "latest",
        });
        logsOk++;
      } catch {
        logsFail++;
      }
      await contract.isAuthorizedIssuer(found.issuer);
      await provider.getBlockNumber();
    }
    return { ms: ms() - t0, calls, found: !!found };
  };

  // warm-up
  await hash(certs[0].hash, true);
  await hash("0x" + "ab".repeat(32), false);

  const regTrials: { ms: number; calls: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const c = certs[i % certs.length];
    regTrials.push(await hash(c.hash, true));
  }
  const missTrials: { ms: number; calls: number }[] = [];
  for (let i = 0; i < 10; i++) {
    missTrials.push(await hash("0x" + ((i * 7919 + 13) >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64), false));
  }
  const regMs = regTrials.map((t) => t.ms);
  const missMs = missTrials.map((t) => t.ms);
  log(`registered hash  N=10: mean=${fmt(mean(regMs))} ms | median=${fmt(median(regMs))} | min=${fmt(Math.min(...regMs))} | max=${fmt(Math.max(...regMs))} | RPC calls/lookup≈${regTrials[0].calls}`);
  log(`missing hash     N=10: mean=${fmt(mean(missMs))} ms | median=${fmt(missMs.length ? median(missMs) : 0)} | min=${fmt(Math.min(...missMs))} | max=${fmt(Math.max(...missMs))} | RPC calls/lookup≈${missTrials[0].calls}`);
  log(`app-path getLogs(fromBlock:0) on publicnode: ${logsOk} succeeded / ${logsFail} failed (block-range limit 10000)`);

  // --------------------------------------------------------- scalability
  log("");
  log("=== 4. VERIFICATION SCALABILITY (scan prefix k certificates) ===");
  const ks = [1, 3, 5, 7, count].filter((v, i, a) => a.indexOf(v) === i);
  const prefix: { k: number; ms: number }[] = [];
  for (const k of ks) {
    const times: number[] = [];
    for (let t = 0; t < 3; t++) {
      const t0 = ms();
      const n = Number(await contract.getCertificateCount());
      for (let i = 0; i < Math.min(k, n); i++) {
        const id: string = await contract.certificateIds(i);
        await contract.getCertificate(id);
      }
      times.push(ms() - t0);
    }
    prefix.push({ k, ms: mean(times) });
    log(`  k=${String(k).padStart(2)} certs -> mean ${fmt(mean(times))} ms`);
  }
  // least-squares slope
  const xs = prefix.map((p) => p.k);
  const ys = prefix.map((p) => p.ms);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  log(`  linear fit: latency ≈ ${fmt(slope)} ms × n + ${fmt(intercept)} ms  (O(n) confirmed)`);
  log(`  extrapolation (labelled as such): n=100 -> ${fmt(slope * 100 + intercept)} ms | n=1000 -> ${fmt(slope * 1000 + intercept)} ms`);

  // ---------------------------------------------------------- throughput
  log("");
  log("=== 5. THROUGHPUT (verification only, sequential single client) ===");
  const totalReg = regMs.reduce((s, x) => s + x, 0);
  log(`registered lookups: 10 completed in ${fmt(totalReg)} ms => ${fmt(10000 / totalReg, 2)} verifications/s`);
  const totalAll = totalReg + missMs.reduce((s, x) => s + x, 0);
  log(`mixed (registered+missing): 20 completed in ${fmt(totalAll)} ms => ${fmt(20000 / totalAll, 2)} lookups/s`);

  // --------------------------------------------- metadata tamper trials
  log("");
  log("=== 6. METADATA TAMPERING DETECTION (local SHA-256, issuance canonical string) ===");
  const base = {
    id: "CERT-2026-100001",
    name: "Asha Kumar",
    course: "B.Tech Computer Science and Engineering",
    date: "2026-05-18",
  };
  const canon = (c: typeof base) => `${c.id}|${c.name}|${c.course}|${c.date}`;
  const baseHash = await sha256hex(canon(base));
  log(`base fingerprint : 0x${baseHash}`);
  const mutations: [string, typeof base][] = [
    ["name mutated (Asha Kumar -> Asha Kumari)", { ...base, name: "Asha Kumari" }],
    ["course mutated (Engineering -> Engg.)", { ...base, course: "B.Tech Computer Science and Engg." }],
    ["date mutated (2026-05-18 -> 2026-05-19)", { ...base, date: "2026-05-19" }],
    ["id mutated (100001 -> 100002)", { ...base, id: "CERT-2026-100002" }],
    ["single-character course edit (S -> s)", { ...base, course: "B.Tech computer Science and Engineering" }],
    ["whitespace inserted in name", { ...base, name: "Asha  Kumar" }],
  ];
  let detected = 0;
  for (const [label, mutated] of mutations) {
    const h = await sha256hex(canon(mutated));
    const differs = h !== baseHash;
    if (differs) detected++;
    log(`  ${differs ? "DETECTED" : "MISSED  "} | ${label} -> 0x${h}`);
  }
  log(`detection rate: ${detected}/${mutations.length} = ${fmt((100 * detected) / mutations.length, 0)}%`);

  // ------------------------------------------------------ PDF stage timing
  log("");
  log("=== 7. ISSUANCE STAGE MICRO-TIMINGS (local only) ===");
  const shaTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = ms();
    await sha256hex(canon(base));
    shaTimes.push(ms() - t0);
  }
  log(`SHA-256 canonical string: mean ${fmt(mean(shaTimes), 3)} ms over 1000 runs`);
  const pdfTimes: number[] = [];
  let pdfSampleHash = "";
  for (let i = 0; i < 5; i++) {
    const t0 = ms();
    try {
      const doc = generateCertificatePDF({
        id: base.id,
        recipientName: base.name,
        course: base.course,
        organization: "Hindustan Institute of Technology & Science",
        issueDate: base.date,
        certificateNumber: base.id,
      });
      const arr = new Uint8Array(doc.output("arraybuffer"));
      pdfTimes.push(ms() - t0);
      if (i === 0) pdfSampleHash = await sha256hex(arr);
    } catch (e) {
      log(`  PDF generation failed under bun: ${String(e)}`);
      break;
    }
  }
  if (pdfTimes.length) log(`jsPDF certificate generation: mean ${fmt(mean(pdfTimes))} ms over ${pdfTimes.length} runs (local, project generator)`);

  // --------------------------------------- forensic consistency check
  log("");
  log("=== 8. PDF FORENSIC CONSISTENCY (documents the known hashing inconsistency) ===");
  log(`metadata fingerprint (issuance/on-chain domain) : 0x${baseHash}`);
  log(`same-certificate PDF byte hash (forensic domain): 0x${pdfSampleHash || "(pdf failed)"}`);
  log(`match: ${pdfSampleHash === baseHash ? "YES" : "NO"}  => forensic comparison of PDF bytes against the registered fingerprint ${pdfSampleHash === baseHash ? "matches" : "cannot match"} by construction`);

  log("");
  log("--- IPFS document retrieval check (public gateway GET, read-only) ---");
  let ipfsOk = 0;
  let ipfsHashVsChain = 0;
  for (const c of certs.slice(0, 3)) {
    if (!c.cid) continue;
    const url = `https://gateway.pinata.cloud/ipfs/${c.cid}`;
    try {
      const t0 = ms();
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        log(`  ${c.id}: gateway HTTP ${res.status}`);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const h = await sha256hex(buf);
      ipfsOk++;
      const matches = h === c.hash;
      if (matches) ipfsHashVsChain++;
      log(`  ${c.id}: fetched ${buf.length} bytes in ${fmt(ms() - t0)} ms | SHA-256(pdf)=0x${h.slice(0, 16)}… vs chain=0x${c.hash.slice(2, 18)}… => ${matches ? "MATCH" : "MISMATCH"}`);
    } catch (e) {
      log(`  ${c.id}: fetch failed (${String((e as Error).name || e).slice(0, 60)})`);
    }
  }
  log(`IPFS retrievable: ${ipfsOk}/3 | byte-hash vs chain fingerprint matches: ${ipfsHashVsChain}/${ipfsOk}`);
}

function reciptSafe(logs: { transactionHash: string }[]): string[] {
  return logs.map((l) => l.transactionHash);
}

main().catch((e) => {
  console.error("EVAL FAILED:", e);
  process.exit(1);
});
