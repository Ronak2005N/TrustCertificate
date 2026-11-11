/**
 * Real certificate service using blockchain + IPFS.
 * All certificate data comes from the Polygon Amoy smart contract.
 */
import { ethers } from "ethers";
import { getContract, getProvider, getSigner, getReadOnlyProvider, isConnectedToAmoy } from "./blockchain/metamask";
import { CONTRACT_ADDRESS } from "./blockchain/contracts";
import {
  getTransactionState,
  submitTransactionAndConfirm,
} from "./blockchain/confirmation";
import { computeSHA256, hexToBytes32 } from "./crypto";
import { generateCertificateFingerprint, normalizeIssueDate } from "./certificate-fingerprint";
import { getPendingTransaction, recordPendingTransaction, removePendingTransaction } from "./pending-transactions";
import {
  IssuanceTimer,
  measureStage,
  recordIssuanceFailure,
  recordIssuanceSuccess,
  trackNonBlockingStage,
  type IssuanceStage,
} from "./issuance-timing";
import { uploadToIPFS } from "./ipfs";
import { generateCertificateBlob } from "./pdf/generate-certificate";
import { extractCertificateMetadata } from "./pdf/extract-certificate-metadata";
import { ORGANIZATION, NETWORK } from "./demo-data";
import { supabase, type SupabaseCertificate } from "./supabase";
import type {
  Certificate,
  CertificateStatus,
  CertificateType,
  BulkRow,
  ForensicField,
  ForensicResult,
} from "./types";

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// In-memory store for issued certificates (persists during session)
const store: Certificate[] = [];

export function listCertificates(): Certificate[] {
  return store;
}

export function findCertificateById(id: string): Certificate | undefined {
  return store.find((c) => c.id.toLowerCase() === id.toLowerCase());
}

export function findCertificateByHash(hash: string): Certificate | undefined {
  return store.find((c) => c.hash.toLowerCase() === hash.trim().toLowerCase());
}

/**
 * Validate a certificate hash (SHA-256, 0x-prefixed, 64 hex chars).
 * Rejects transaction hashes, wallet addresses, and contract addresses.
 */
export function isHashLike(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export function shorten(value: string, lead = 6, tail = 4) {
  if (!value) return "";
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${formatDate(value)} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC`;
}

export function explorerTx(tx: string) {
  return `${NETWORK.explorer}/tx/${tx}`;
}

export function explorerAddress(address: string) {
  return `${NETWORK.explorer}/address/${address}`;
}

// --- Registration transaction resolution ---
//
// The public Amoy RPC caps eth_getLogs at a 10,000-block range, so the
// fromBlock:0 event scan used to recover a certificate's registration
// transaction hash returns nothing on this network (pre-existing: Task-6
// benchmark recorded 0/10 event-scan tx hashes). When the scan is empty and a
// candidate tx hash is supplied (e.g. the one persisted to Supabase at
// issuance), the candidate is only accepted after verifying it ON-CHAIN: the
// receipt must be successful and contain a CertificateRegistered log emitted
// by the registry contract for this exact certificate id. Unverifiable values
// are never presented as blockchain proof. Best-effort: on any error the
// candidate is discarded and an empty result is returned.

interface RegistrationTx {
  transactionHash: string;
  blockNumber: number;
}

async function resolveRegistrationTx(
  provider: ethers.JsonRpcProvider,
  certId: string,
  expectedTx?: string,
): Promise<RegistrationTx> {
  // Primary: scan CertificateRegistered events for this certificate id.
  try {
    const eventAbi = [
      "event CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)",
    ];
    const eventIface = new ethers.Interface(eventAbi);
    const topic0 = eventIface.getEvent("CertificateRegistered")!.topicHash;
    const topic1 = ethers.id(certId);
    const logs = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [topic0, topic1],
      fromBlock: 0,
      toBlock: "latest",
    });
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog) {
        return { transactionHash: lastLog.transactionHash, blockNumber: lastLog.blockNumber };
      }
    }
  } catch {
    // Fall through to the receipt-verified path.
  }

  // Fallback: verify the candidate tx hash against its on-chain receipt.
  if (expectedTx && /^0x[0-9a-fA-F]{64}$/.test(expectedTx)) {
    try {
      const receipt = await provider.getTransactionReceipt(expectedTx);
      if (receipt && receipt.status === 1) {
        const iface = new ethers.Interface([
          "event CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)",
        ]);
        const topic0 = iface.getEvent("CertificateRegistered")!.topicHash;
        const topic1 = ethers.id(certId);
        const matches = receipt.logs.some(
          (log) =>
            log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() &&
            log.topics[0] === topic0 &&
            log.topics[1] === topic1,
        );
        if (matches) {
          return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
        }
      }
    } catch {
      // Discard unverifiable candidate.
    }
  }

  return { transactionHash: "", blockNumber: 0 };
}

// --- Supabase Metadata ---

function mapSupabaseToCertificate(row: SupabaseCertificate): Certificate {
  return {
    id: row.certificate_id,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    course: row.course,
    type: row.certificate_type as CertificateType,
    organization: ORGANIZATION.name,
    issueDate: row.issue_date,
    hash: row.certificate_hash,
    status: row.status as CertificateStatus,
    chain: {
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      contract: CONTRACT_ADDRESS,
      issuerWallet: row.issuer_wallet,
      transactionHash: row.transaction_hash,
      block: 0,
      confirmedAt: row.issue_date,
    },
  };
}

export async function fetchAllCertificatesFromSupabase(): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Supabase fetch error:", error);
    return [];
  }

  return data.map(mapSupabaseToCertificate);
}

export async function fetchCertificateFromSupabase(certId: string): Promise<Certificate | null> {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("certificate_id", certId)
    .single();

  if (error || !data) return null;
  return mapSupabaseToCertificate(data);
}

export async function fetchCertificateByHashFromSupabase(hash: string): Promise<Certificate | null> {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("certificate_hash", hash.toLowerCase())
    .single();

  if (error || !data) return null;
  return mapSupabaseToCertificate(data);
}

async function saveCertificateToSupabase(cert: Certificate, ipfsCid: string): Promise<void> {
  const { error } = await supabase
    .from("certificates")
    .insert({
      certificate_id: cert.id,
      recipient_name: cert.recipientName,
      recipient_email: cert.recipientEmail,
      course: cert.course,
      certificate_type: cert.type,
      certificate_hash: cert.hash.toLowerCase(),
      transaction_hash: cert.chain.transactionHash,
      issuer_wallet: cert.chain.issuerWallet,
      ipfs_cid: ipfsCid,
      issue_date: cert.issueDate,
      status: cert.status,
    });

  if (error) {
    console.error("Failed to save certificate to Supabase:", error);
  }
}

async function updateCertificateStatusInSupabase(
  certId: string,
  status: "active" | "revoked"
): Promise<void> {
  // Guard: only touch a row whose certificate_hash matches the authoritative
  // on-chain record for this certificate_id. A poisoned duplicate row that
  // reuses the same certificate_id with a different hash must never be
  // updated, and an inconclusive chain lookup (RPC failure) never flips a
  // client-supplied status — the chain remains the source of truth.
  const chainRecord = await lookupOnChainCertificateRecord(certId);
  if (chainRecord.state !== "found") {
    console.error(
      `Supabase status update skipped for ${certId}: on-chain record ${chainRecord.state} — refusing to update on inconclusive identity.`,
    );
    return;
  }

  const { error } = await supabase
    .from("certificates")
    .update({ status })
    .eq("certificate_id", certId)
    .eq("certificate_hash", chainRecord.record.hash.toLowerCase());

  if (error) {
    console.error("Failed to update certificate in Supabase:", error);
  }
}

// --- Supabase ↔ Blockchain Integrity Boundary ---
//
// The blockchain is authoritative for certificate identity (certificate_id +
// certificate_hash) and status. Supabase rows are untrusted display metadata:
// with the public anon key in the browser, a row can only be trusted to the
// extent that it is anchored to an on-chain record. The helpers below
// implement that boundary; RLS itself is NOT enforced here (see
// supabase/rls-hardening.sql — requires external configuration).

/** Authoritative on-chain facts about a certificate. */
export interface ChainCertificateRecord {
  hash: string;
  status: CertificateStatus;
}

/**
 * Result of an on-chain identity lookup:
 * - "found":   the contract returned a record for this certificate_id,
 * - "missing": the contract definitively reported no such certificate
 *              (reverted with "Certificate not found"),
 * - "error":   the lookup was inconclusive (RPC/network failure).
 */
export type ChainLookupResult =
  | { state: "found"; record: ChainCertificateRecord }
  | { state: "missing" }
  | { state: "error" };

function isContractMissError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  const reason = (err as { reason?: unknown }).reason;
  const message = err instanceof Error ? err.message : "";
  return (
    code === "CALL_EXCEPTION" ||
    (typeof reason === "string" && reason.includes("Certificate not found")) ||
    message.includes("Certificate not found")
  );
}

/**
 * Lightweight on-chain identity lookup (single eth_call, no event scan).
 * Distinguishes a definitive on-chain miss from an inconclusive RPC failure
 * so callers can fail closed on poison and fail open on outages.
 */
async function lookupOnChainCertificateRecord(certId: string): Promise<ChainLookupResult> {
  try {
    const provider = getReadOnlyProvider();
    const contract = await getContract(provider);
    const getCertFn = contract["getCertificate(string)"];
    if (!getCertFn) return { state: "error" };
    const result = await getCertFn(certId);
    const hash = result[0] as string;
    if (!hash || /^0x0{64}$/i.test(hash)) return { state: "missing" };
    return {
      state: "found",
      record: {
        hash,
        status: Number(result[5]) === 0 ? "active" : "revoked",
      },
    };
  } catch (err) {
    return isContractMissError(err) ? { state: "missing" } : { state: "error" };
  }
}

/**
 * Recompute the canonical metadata fingerprint for a Supabase-backed row and
 * compare it with the on-chain anchor. Display metadata (recipient, course,
 * issue date, certificate id) is only trusted when the recomputed fingerprint
 * equals the on-chain certificate hash — a poisoned row fails this check.
 */
export async function isSupabaseMetadataConsistentWithChain(
  row: Pick<Certificate, "id" | "recipientName" | "course" | "issueDate">,
  onChainHash: string,
): Promise<boolean> {
  const fingerprint = await generateCertificateFingerprint({
    certificateId: row.id,
    recipientName: row.recipientName,
    course: row.course,
    issueDate: row.issueDate,
  });
  return fingerprint.toLowerCase() === onChainHash.trim().toLowerCase();
}

/**
 * Pure reconciliation of Supabase metadata rows with authoritative on-chain
 * records (network access happens in the injected lookup):
 * - "missing" on chain → row dropped (metadata-only rows are not registry
 *   entries and are never presented as certificates),
 * - on-chain hash ≠ row certificate_hash → row dropped (poisoned identity),
 * - "found" + hash match → row kept, with on-chain hash and status overriding
 *   the client-supplied values,
 * - "error" → row kept unchanged (availability during RPC outages; Method A
 *   / Method C verification still reads status from the chain directly).
 */
export async function reconcileSupabaseRowsWithChain(
  rows: Certificate[],
  lookup: (certId: string) => Promise<ChainLookupResult>,
): Promise<Certificate[]> {
  const reconciled = await Promise.all(
    rows.map(async (row): Promise<Certificate | null> => {
      const result = await lookup(row.id);
      if (result.state === "error") return row;
      if (result.state === "missing") return null;
      if (row.hash.trim().toLowerCase() !== result.record.hash.trim().toLowerCase()) {
        return null;
      }
      return { ...row, hash: result.record.hash, status: result.record.status };
    }),
  );
  return reconciled.filter((row): row is Certificate => row !== null);
}

/**
 * Fetch a certificate for public display with a blockchain cross-check.
 * The Supabase row is treated as untrusted metadata:
 * - no Supabase row → null (no display metadata to show),
 * - no matching on-chain record → null (a metadata-only row never renders as
 *   a certificate),
 * - on-chain record is authoritative for hash, status, issuer wallet,
 *   transaction and block,
 * - when the (RPC-capped) event scan produced no transaction hash, the row's
 *   stored transaction_hash is only used after on-chain receipt+log
 *   verification (see resolveRegistrationTx),
 * - recipient/course/type are only copied over when the recomputed metadata
 *   fingerprint matches the on-chain hash.
 */
export async function fetchVerifiedCertificateFromSupabase(
  certId: string,
): Promise<Certificate | null> {
  const row = await fetchCertificateFromSupabase(certId);
  if (!row) return null;

  // The row's persisted tx hash is passed only as a CANDIDATE: it is
  // accepted into the chain record solely after on-chain receipt+log
  // verification (see resolveRegistrationTx).
  const chainCert = await fetchCertificateFromChain(certId, row.chain.transactionHash);
  if (!chainCert) return null;
  if (row.hash.trim().toLowerCase() !== chainCert.hash.trim().toLowerCase()) return null;

  const metadataTrusted = await isSupabaseMetadataConsistentWithChain(row, chainCert.hash);
  return {
    ...chainCert,
    ...(metadataTrusted
      ? {
          recipientName: row.recipientName,
          recipientEmail: row.recipientEmail,
          course: row.course,
          type: row.type,
        }
      : {}),
  };
}

// --- Blockchain Event Fetching ---

/**
 * Fetch all certificates from CertificateRegistered events on-chain.
 * This is the single source of truth for certificate data.
 */
export async function fetchAllCertificates(): Promise<Certificate[]> {
  const provider = getReadOnlyProvider();
  const contract = await getContract(provider);

  const getCountFn = contract["getCertificateCount()"];
  const getCertFn = contract["getCertificate(string)"];
  const getIdsFn = contract["certificateIds(uint256)"];
  if (!getCountFn || !getCertFn || !getIdsFn) return [];

  const certCount: bigint = await getCountFn();
  const certs: Certificate[] = [];

  for (let i = 0; i < Number(certCount); i++) {
    const certId: string = await getIdsFn(i);
    try {
      const result = await getCertFn(certId);
      const onChainHash = result[0] as string;
      const issuerAddress = result[1] as string;
      const ipfsCID = result[2] as string;
      const issueTimestamp = Number(result[4]);
      const status = Number(result[5]);

      // Recover the registration transaction (event scan with receipt-verified
      // fallback — see resolveRegistrationTx).
      const { transactionHash: txHash, blockNumber } = await resolveRegistrationTx(provider, certId);

      certs.push({
        id: certId,
        recipientName: "",
        recipientEmail: "",
        course: "",
        type: "Completion" as CertificateType,
        organization: ORGANIZATION.name,
        issueDate: new Date(issueTimestamp * 1000).toISOString(),
        hash: onChainHash,
        status: status === 0 ? "active" : "revoked",
        chain: {
          network: NETWORK.name,
          chainId: NETWORK.chainId,
          contract: CONTRACT_ADDRESS,
          issuerWallet: issuerAddress,
          transactionHash: txHash,
          block: blockNumber,
          confirmedAt: new Date(issueTimestamp * 1000).toISOString(),
        },
      });
    } catch {
      continue;
    }
  }

  return certs;
}

/**
 * Fetch a single certificate from the blockchain by ID.
 * `candidateTxHash` (e.g. the tx hash persisted at issuance) is used to
 * recover the registration transaction when the RPC-capped event scan comes
 * back empty — accepted only after on-chain receipt+log verification.
 */
export async function fetchCertificateFromChain(
  certId: string,
  candidateTxHash?: string,
): Promise<Certificate | null> {
  try {
    const provider = getReadOnlyProvider();
    const contract = await getContract(provider);
    const getCertFn = contract["getCertificate(string)"];
    if (!getCertFn) return null;

    const result = await getCertFn(certId);
    const onChainHash = result[0] as string;
    const issuerAddress = result[1] as string;
    const ipfsCID = result[2] as string;
    const issueTimestamp = Number(result[4]);
    const status = Number(result[5]);

    // Recover the registration transaction (event scan with receipt-verified
    // fallback — see resolveRegistrationTx).
    const { transactionHash: txHash, blockNumber } = await resolveRegistrationTx(
      provider,
      certId,
      candidateTxHash,
    );

    return {
      id: certId,
      recipientName: "",
      recipientEmail: "",
      course: "",
      type: "Completion" as CertificateType,
      organization: ORGANIZATION.name,
      issueDate: new Date(issueTimestamp * 1000).toISOString(),
      hash: onChainHash,
      status: status === 0 ? "active" : "revoked",
      chain: {
        network: NETWORK.name,
        chainId: NETWORK.chainId,
        contract: CONTRACT_ADDRESS,
        issuerWallet: issuerAddress,
        transactionHash: txHash,
        block: blockNumber,
        confirmedAt: new Date(issueTimestamp * 1000).toISOString(),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Fetch transaction receipt details from the blockchain.
 */
export async function fetchTransactionDetails(txHash: string): Promise<{
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  gasUsed: string;
  status: number;
  timestamp: number;
} | null> {
  try {
    const provider = getReadOnlyProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    const block = await provider.getBlock(receipt.blockNumber);

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to || "",
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status || 0,
      timestamp: block?.timestamp || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Receipt lookup used by the confirmation state machine's final checks.
 * Read-only public RPC first (avoids MetaMask rate limiting), wallet provider
 * second. Returns null when neither produces a receipt — never fabricates
 * one; null simply means "not observed yet" (pending/unknown).
 */
async function fetchReceiptFromChain(txHash: string): Promise<ethers.TransactionReceipt | null> {
  try {
    return await getReadOnlyProvider().getTransactionReceipt(txHash);
  } catch {
    // fall through to the wallet provider
  }
  try {
    const browserProvider = await getProvider();
    return await browserProvider.getTransactionReceipt(txHash);
  } catch {
    return null;
  }
}

/**
 * Sync in-memory store with Supabase data, cross-checked against the chain.
 * Supabase rows are reconciled with authoritative on-chain records first:
 * rows without a matching on-chain certificate_hash are dropped, and status
 * always comes from the chain — the dashboard never presents unreconciled
 * client-supplied metadata as registry entries.
 * Falls back to blockchain if Supabase is unavailable or fully poisoned.
 * Call this on dashboard load and after issuing certificates.
 */
export async function syncCertificatesFromChain(): Promise<Certificate[]> {
  const supabaseCerts = await fetchAllCertificatesFromSupabase();
  if (supabaseCerts.length > 0) {
    const reconciled = await reconcileSupabaseRowsWithChain(
      supabaseCerts,
      lookupOnChainCertificateRecord,
    );
    if (reconciled.length > 0) {
      store.length = 0;
      store.push(...reconciled);
      return reconciled;
    }
    // Every Supabase row failed reconciliation (or all lookups were
    // definitive misses) — fall through to the chain instead of rendering an
    // empty/poisoned dashboard.
  }
  const certs = await fetchAllCertificates();
  store.length = 0;
  store.push(...certs);
  return certs;
}

export const VERIFICATION_STAGES = [
  "Validating hash format",
  "Connecting to Polygon Amoy",
  "Querying smart contract",
  "Retrieving certificate record",
];

export type VerificationError =
  | { type: "invalid_hash"; message: string }
  | { type: "rpc_error"; message: string }
  | { type: "contract_error"; message: string }
  | { type: "not_found"; message: string }
  | { type: "network_error"; message: string };

export async function verifyCertificate(
  hash: string,
  onStage?: (index: number) => void,
): Promise<{
  outcome: "verified" | "revoked" | "not_found" | "error";
  hash: string;
  certificate?: Certificate;
  checks: { label: string; value: string; pass: boolean }[];
  error?: VerificationError;
}> {
  // Stage 0: Validate hash format
  onStage?.(0);
  const cleanHash = hash.trim();
  if (!isHashLike(cleanHash)) {
    onStage?.(VERIFICATION_STAGES.length);
    return {
      outcome: "error",
      hash: cleanHash,
      checks: [],
      error: {
        type: "invalid_hash",
        message: "Invalid certificate hash. Expected a 0x-prefixed 64-character hexadecimal SHA-256 hash.",
      },
    };
  }

  // Stage 1: Connect to blockchain
  onStage?.(1);
  let provider: ethers.JsonRpcProvider;
  try {
    provider = getReadOnlyProvider();
  } catch {
    onStage?.(VERIFICATION_STAGES.length);
    return {
      outcome: "error",
      hash: cleanHash,
      checks: [],
      error: {
        type: "rpc_error",
        message: "Unable to connect to Polygon Amoy network. Please check your connection and try again.",
      },
    };
  }

  // Stage 2: Query smart contract
  onStage?.(2);
  let contract: ethers.Contract;
  try {
    contract = await getContract(provider);
  } catch {
    onStage?.(VERIFICATION_STAGES.length);
    return {
      outcome: "error",
      hash: cleanHash,
      checks: [],
      error: {
        type: "contract_error",
        message: "Unable to load the CertiProof smart contract. The contract may not be deployed on this network.",
      },
    };
  }

  // Stage 3: Search for certificate
  onStage?.(3);
  try {
    const getCountFn = contract["getCertificateCount()"];
    const getCertFn = contract["getCertificate(string)"];
    const getIdsFn = contract["certificateIds(uint256)"];
    const isIssuerFn = contract["isAuthorizedIssuer(address)"];
    if (!getCountFn || !getCertFn || !getIdsFn) {
      return {
        outcome: "error",
        hash: cleanHash,
        checks: [],
        error: {
          type: "contract_error",
          message: "Smart contract interface unavailable. Please verify the contract is deployed correctly.",
        },
      };
    }

    const certCount: bigint = await getCountFn();
    const searchHash = cleanHash.toLowerCase();

    for (let i = 0; i < Number(certCount); i++) {
      const certId: string = await getIdsFn(i);
      try {
        const result = await getCertFn(certId);
        const onChainHash = (result[0] as string).toLowerCase();

        if (onChainHash === searchHash || onChainHash === hexToBytes32(searchHash)) {
          const issuerAddress = result[1] as string;
          const ipfsCID = result[2] as string;
          const certNumber = result[3] as string;
          const issueTimestamp = Number(result[4]);
          const status = Number(result[5]);
          const revoked = status !== 0;

          // Cross-reference Supabase for metadata (recipient name, course,
          // etc.). The row is untrusted display metadata: its fields are only
          // copied into the result when the recomputed metadata fingerprint
          // matches the on-chain hash — poisoned metadata is never presented
          // alongside a verified blockchain record.
          const supabaseCert = await fetchCertificateByHashFromSupabase(cleanHash);

          // Recover the registration transaction (event scan; the Supabase
          // persisted tx hash is only used after on-chain receipt+log
          // verification — see resolveRegistrationTx).
          const { transactionHash: txHash, blockNumber } = await resolveRegistrationTx(
            provider,
            certId,
            supabaseCert?.chain.transactionHash,
          );

          // Check issuer authorization
          let issuerAuthorized = false;
          if (isIssuerFn) {
            try {
              issuerAuthorized = await isIssuerFn(issuerAddress);
            } catch {
              // If check fails, still continue
            }
          }

          // Get current block for confirmation count
          let confirmations = 0;
          try {
            const currentBlock = await provider.getBlockNumber();
            confirmations = currentBlock - blockNumber;
          } catch {
            // Continue without confirmation count
          }

          const cert: Certificate = {
            id: certId,
            recipientName: "",
            recipientEmail: "",
            course: "",
            type: "Completion" as CertificateType,
            organization: ORGANIZATION.name,
            issueDate: new Date(issueTimestamp * 1000).toISOString(),
            hash: result[0] as string,
            status: revoked ? "revoked" : "active",
            chain: {
              network: NETWORK.name,
              chainId: NETWORK.chainId,
              contract: CONTRACT_ADDRESS,
              issuerWallet: issuerAddress,
              transactionHash: txHash,
              block: blockNumber,
              confirmedAt: new Date(issueTimestamp * 1000).toISOString(),
            },
          };

          let metadataTrusted = false;
          if (supabaseCert) {
            metadataTrusted = await isSupabaseMetadataConsistentWithChain(supabaseCert, onChainHash);
            if (metadataTrusted) {
              cert.recipientName = supabaseCert.recipientName;
              cert.recipientEmail = supabaseCert.recipientEmail;
              cert.course = supabaseCert.course;
              cert.type = supabaseCert.type;
            }
          }

          const checks: { label: string; value: string; pass: boolean }[] = [
            { label: "Hash Match", value: "PASS", pass: true },
          ];

          // Recompute the metadata fingerprint from stored metadata using the
          // exact canonicalization used at issuance, and compare with the
          // fingerprint anchored on-chain.
          if (supabaseCert) {
            checks.push({
              label: "Metadata Fingerprint",
              value: metadataTrusted ? "MATCH" : "MISMATCH",
              pass: metadataTrusted,
            });
          }

          checks.push(
            {
              label: "Issuer Authorization",
              value: issuerAuthorized ? "AUTHORIZED" : "UNAUTHORIZED",
              pass: issuerAuthorized,
            },
            {
              label: "Revocation Status",
              value: revoked ? "REVOKED" : "ACTIVE",
              pass: !revoked,
            },
            {
              label: "Blockchain Record",
              value: txHash ? `BLOCK #${blockNumber.toLocaleString("en-US")}` : "CONFIRMED",
              pass: !!txHash,
            },
            {
              label: "Confirmations",
              value: confirmations > 0 ? `${confirmations.toLocaleString("en-US")} blocks` : "PENDING",
              pass: confirmations > 0,
            },
            {
              label: "IPFS Document",
              value: ipfsCID ? "STORED" : "MISSING",
              pass: !!ipfsCID,
            },
          );

          return {
            outcome: revoked ? "revoked" : "verified",
            hash: cert.hash,
            certificate: cert,
            checks,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      outcome: "not_found",
      hash: cleanHash,
      checks: [],
      error: {
        type: "not_found",
        message: "No certificate with this hash exists in the CertiProof registry on Polygon Amoy.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      outcome: "error",
      hash: cleanHash,
      checks: [],
      error: {
        type: "network_error",
        message: `Blockchain query failed: ${msg}`,
      },
    };
  }
}

export const ISSUANCE_STAGES = [
  "Generating cryptographic hash (SHA-256)",
  "Generating certificate PDF",
  "Uploading to IPFS",
  "Preparing blockchain transaction",
  "Submitting to Polygon Amoy",
  "Waiting for confirmation",
  "Complete",
];

export type IssuanceError =
  | { type: "metamask_missing"; message: string }
  | { type: "wrong_network"; message: string }
  | { type: "insufficient_funds"; message: string }
  | { type: "transaction_rejected"; message: string }
  | { type: "ipfs_failed"; message: string }
  | { type: "contract_error"; message: string }
  | { type: "network_timeout"; message: string }
  | { type: "confirmation_pending"; message: string; transactionHash: string }
  | { type: "transaction_failed"; message: string; transactionHash?: string | null }
  | { type: "unknown"; message: string };

function parseIssuanceError(err: unknown): IssuanceError {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("MetaMask") || msg.includes("not installed")) {
    return { type: "metamask_missing", message: "MetaMask is not installed. Please install MetaMask to continue." };
  }
  if (msg.includes("wallet_wrongNetwork") || msg.includes("switch")) {
    return { type: "wrong_network", message: "Wrong network. Please switch MetaMask to Polygon Amoy." };
  }
  if (msg.includes("insufficient funds") || msg.includes("insufficient balance") || msg.includes("fee")) {
    return { type: "insufficient_funds", message: "Insufficient POL for gas fees. Please add POL to your wallet." };
  }
  if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("4001")) {
    return { type: "transaction_rejected", message: "Transaction rejected in MetaMask. Please try again." };
  }
  if (msg.includes("IPFS") || msg.includes("pinata") || msg.includes("upload")) {
    return { type: "ipfs_failed", message: "Failed to upload certificate to IPFS. Please check your connection and try again." };
  }
  if (msg.includes("revert") || msg.includes("execution reverted")) {
    return { type: "contract_error", message: "Blockchain transaction failed. The contract rejected the request." };
  }
  if (msg.includes("timeout") || msg.includes("RPC")) {
    return { type: "network_timeout", message: "Network timeout. The transaction may have succeeded — check the dashboard." };
  }
  return { type: "unknown", message: `An unexpected error occurred: ${msg}` };
}

export interface IssueInput {
  recipientName: string;
  recipientEmail: string;
  course: string;
  type: CertificateType;
  issueDate: string;
  description?: string;
}

/**
 * Build a certificate object from issuance data + REAL confirmation evidence
 * (transaction hash and block number come only from a mined receipt).
 */
function buildIssuedCertificate(args: {
  input: IssueInput;
  id: string;
  hash: string;
  issuerWallet: string;
  transactionHash: string;
  block: number;
}): Certificate {
  return {
    id: args.id,
    recipientName: args.input.recipientName,
    recipientEmail: args.input.recipientEmail,
    course: args.input.course,
    type: args.input.type,
    organization: ORGANIZATION.name,
    issueDate: args.input.issueDate,
    ...(args.input.description ? { description: args.input.description } : {}),
    hash: args.hash,
    status: "active",
    chain: {
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      contract: CONTRACT_ADDRESS,
      issuerWallet: args.issuerWallet,
      transactionHash: args.transactionHash,
      block: args.block,
      confirmedAt: new Date().toISOString(),
    },
  };
}

export async function issueCertificate(
  input: IssueInput,
  onStage?: (index: number) => void,
): Promise<Certificate> {
  // Timing instrumentation: records real stage durations; never alters behavior.
  const timer = new IssuanceTimer();
  let submittedTxHash: string | undefined;

  // Wrong-chain guard: signing on any network other than Polygon Amoy would
  // submit a REAL transaction that registers nothing on the intended chain —
  // and a call to an address without code still mines with receipt status 1,
  // which the confirmation machine would (correctly, for that chain) classify
  // as success. Check BEFORE any side effect (IPFS pin, gas spend).
  if (!(await isConnectedToAmoy())) {
    recordIssuanceFailure(timer, {
      failedStage: "blockchainPreparation",
      errorCategory: "wrong_network",
      transactionSubmitted: false,
      transactionHash: null,
    });
    throw {
      type: "wrong_network" as const,
      message: "Wrong network. Please switch MetaMask to Polygon Amoy before issuing.",
    };
  }

  const failAt: (failedStage: IssuanceStage, err: unknown) => never = (failedStage, err) => {
    const parsed = parseIssuanceError(err);
    recordIssuanceFailure(timer, {
      failedStage,
      errorCategory: parsed.type,
      transactionSubmitted: submittedTxHash !== undefined,
      transactionHash: submittedTxHash ?? null,
    });
    throw parsed;
  };

  // Stage 0: Generate the canonical metadata fingerprint (SHA-256)
  onStage?.(0);
  const certId = `CERT-2026-${String(Date.now()).slice(-6)}`;
  timer.setCertificateId(certId);
  const hash = await measureStage(timer, "fingerprint", () =>
    generateCertificateFingerprint({
      certificateId: certId,
      recipientName: input.recipientName,
      course: input.course,
      issueDate: input.issueDate,
    }),
  );

  // Stage 1: Generate PDF
  onStage?.(1);
  const blob = await measureStage(timer, "pdf", () =>
    generateCertificateBlob({
      id: certId,
      recipientName: input.recipientName,
      course: input.course,
      organization: ORGANIZATION.name,
      issueDate: input.issueDate,
      certificateNumber: certId,
    }),
  );
  const file = new File([blob], `${certId}.pdf`, { type: "application/pdf" });

  // Stage 2: Upload to IPFS
  onStage?.(2);
  let ipfsResult;
  try {
    ipfsResult = await measureStage(timer, "ipfs", () => uploadToIPFS(file));
  } catch (err) {
    failAt("ipfs", err);
  }

  // Stage 3-5: Blockchain transaction
  onStage?.(3);
  let signer;
  let contract;
  try {
    [signer, contract] = await measureStage(timer, "blockchainPreparation", async () => {
      const s = await getSigner();
      const c = await getContract(s);
      return [s, c] as const;
    });
  } catch (err) {
    failAt("blockchainPreparation", err);
  }

  onStage?.(4);
  const hashBytes32 = hexToBytes32(hash);
  const registerFn = contract["registerCertificate(string,bytes32,string,string)"];
  if (!registerFn) {
    recordIssuanceFailure(timer, {
      failedStage: "blockchainSubmission",
      errorCategory: "contract_error",
      transactionSubmitted: false,
      transactionHash: null,
    });
    throw { type: "contract_error" as const, message: "Contract function not found. Please refresh and try again." };
  }

  // Submit the transaction and wait for REAL confirmation. The state machine
  // guarantees: only a mined receipt with status 1 reaches the completion path.
  const confirmation = await submitTransactionAndConfirm(
    () =>
      measureStage(timer, "blockchainSubmission", () =>
        registerFn(
          certId,
          hashBytes32,
          ipfsResult.cid,
          certId,
          {
            maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
            maxFeePerGas: ethers.parseUnits("50", "gwei"),
          }
        ),
      ),
    {
      fetchReceipt: fetchReceiptFromChain,
      onSubmitted: (submitted) => {
        submittedTxHash = submitted.hash;
        onStage?.(5);
        timer.startStage("blockchainConfirmation");
      },
    },
  );
  if (timer.hasOpenStage("blockchainConfirmation")) timer.endStage("blockchainConfirmation");

  if (confirmation.state === "pending") {
    // TIMEOUT ≠ success: the transaction may still mine later. Preserve the
    // hash + issuance payload for a later re-check; do NOT build a
    // certificate, do NOT touch the store, do NOT persist to Supabase.
    let pendingWallet = "";
    try {
      pendingWallet = await signer.getAddress();
    } catch {
      // Wallet may be locked — the tx hash is preserved regardless.
    }
    recordPendingTransaction({
      kind: "issuance",
      txHash: confirmation.txHash,
      certificateId: certId,
      fingerprint: hash,
      ipfsCid: ipfsResult.cid,
      issuerWallet: pendingWallet,
      input,
      submittedAt: new Date().toISOString(),
    });
    recordIssuanceFailure(timer, {
      failedStage: "blockchainConfirmation",
      errorCategory: "confirmation_pending",
      transactionSubmitted: true,
      transactionHash: confirmation.txHash,
    });
    throw {
      type: "confirmation_pending" as const,
      message:
        `Transaction submitted to Polygon Amoy but not confirmed within the confirmation window. ` +
        `It may still be mined — no certificate was finalized yet. ` +
        `Transaction ${confirmation.txHash}.`,
      transactionHash: confirmation.txHash,
    };
  }

  if (confirmation.state === "failed") {
    if (confirmation.reason === "submission_error") {
      // Submission itself failed (rejection, funds, RPC) — identical handling
      // to the pre-existing path: parse, record, throw the typed error.
      failAt("blockchainSubmission", confirmation.error);
    }
    // A REAL receipt exists but the transaction did not succeed on-chain
    // (reverted / no success status / cancelled replacement).
    recordIssuanceFailure(timer, {
      failedStage: "blockchainConfirmation",
      errorCategory: "transaction_reverted",
      transactionSubmitted: confirmation.txHash !== null,
      transactionHash: confirmation.txHash,
    });
    throw {
      type: "transaction_failed" as const,
      message:
        `The transaction was mined but did not succeed on Polygon Amoy, so no certificate was registered.` +
        (confirmation.txHash ? ` Transaction ${confirmation.txHash}.` : ""),
      transactionHash: confirmation.txHash,
    };
  }

  // Stage 6: Complete — reached ONLY with a real mined receipt (status 1).
  onStage?.(6);
  const receipt = confirmation.receipt;

  const cert = buildIssuedCertificate({
    input,
    id: certId,
    hash,
    issuerWallet: await signer.getAddress(),
    transactionHash: receipt.hash,
    block: receipt.blockNumber,
  });

  // Add to in-memory store for dashboard display
  addToStore(cert);

  // Save metadata to Supabase (non-blocking) — timed separately; not awaited.
  // Reached only after REAL blockchain confirmation, so a pending transaction
  // is never persisted as a confirmed certificate.
  trackNonBlockingStage(timer, "supabasePersistence", saveCertificateToSupabase(cert, ipfsResult.cid));

  recordIssuanceSuccess(timer, { transactionHash: receipt.hash, cid: ipfsResult.cid });

  return cert;
}

export const REVOKE_STAGES = [
  "Preparing revocation transaction",
  "Submitting to Polygon Amoy",
  "Waiting for confirmation",
];

export async function revokeCertificate(
  id: string,
  onStage?: (index: number) => void,
): Promise<Certificate> {
  onStage?.(0);
  await wait(200);

  // Wrong-chain guard: a revocation signed on another network would mine as a
  // no-op (status 1) and must never be treated as revoking on Amoy.
  if (!(await isConnectedToAmoy())) {
    throw {
      type: "wrong_network" as const,
      message: "Wrong network. Please switch MetaMask to Polygon Amoy before revoking.",
    };
  }

  let signer;
  try {
    signer = await getSigner();
  } catch (err) {
    throw parseIssuanceError(err);
  }

  onStage?.(1);
  let contract;
  try {
    contract = await getContract(signer);
  } catch (err) {
    throw parseIssuanceError(err);
  }

  const revokeFn = contract["revokeCertificate(string)"];
  if (!revokeFn) {
    throw { type: "contract_error" as const, message: "Contract function not available." };
  }

  // Submit + confirm through the shared state machine: a revocation is only
  // treated as done when a REAL mined receipt exists.
  const confirmation = await submitTransactionAndConfirm(
    () =>
      revokeFn(id, {
        maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
        maxFeePerGas: ethers.parseUnits("50", "gwei"),
      }),
    {
      fetchReceipt: fetchReceiptFromChain,
      onSubmitted: () => onStage?.(2),
    },
  );

  if (confirmation.reason === "submission_error") {
    const msg =
      confirmation.error instanceof Error ? confirmation.error.message : String(confirmation.error);
    console.error("Revoke transaction error:", msg, confirmation.error);
    throw parseIssuanceError(confirmation.error);
  }

  if (confirmation.state === "pending") {
    // TIMEOUT ≠ revoked: keep the hash for a later re-check and do NOT flip
    // the Supabase status — the certificate stays active until mined.
    recordPendingTransaction({
      kind: "revocation",
      txHash: confirmation.txHash,
      certificateId: id,
      submittedAt: new Date().toISOString(),
    });
    throw {
      type: "confirmation_pending" as const,
      message:
        `Revocation submitted to Polygon Amoy but not confirmed within the confirmation window. ` +
        `The certificate remains active until the transaction is mined. ` +
        `Transaction ${confirmation.txHash}.`,
      transactionHash: confirmation.txHash,
    };
  }

  if (confirmation.state === "failed") {
    throw {
      type: "transaction_failed" as const,
      message:
        `The revocation transaction was mined but did not succeed on Polygon Amoy. ` +
        `The certificate was NOT revoked.` +
        (confirmation.txHash ? ` Transaction ${confirmation.txHash}.` : ""),
      transactionHash: confirmation.txHash,
    };
  }

  const receipt = confirmation.receipt;

  // Update status in Supabase — only after REAL confirmation.
  await updateCertificateStatusInSupabase(id, "revoked").catch(() => {});

  // Fetch updated certificate data via read-only provider
  const readOnlyProvider = getReadOnlyProvider();
  const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, contract.interface, readOnlyProvider);
  const getCertFn = readOnlyContract["getCertificate(string)"];
  if (!getCertFn) {
    throw { type: "contract_error" as const, message: "Failed to fetch updated certificate data." };
  }
  const result = await getCertFn(id);

  return {
    id,
    recipientName: "",
    recipientEmail: "",
    course: "",
    type: "Completion" as CertificateType,
    organization: ORGANIZATION.name,
    issueDate: new Date(Number(result[4]) * 1000).toISOString(),
    hash: result[0] as string,
    status: "revoked",
    chain: {
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      contract: CONTRACT_ADDRESS,
      issuerWallet: result[1] as string,
      transactionHash: confirmation.txHash,
      block: receipt.blockNumber,
      confirmedAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
    },
  };
}

export type PendingTransactionCheck = {
  state: "confirmed" | "failed" | "pending";
  txHash: string;
  /** Set only when a session pending record existed and the tx is confirmed. */
  certificate: Certificate | null;
};

/**
 * One-shot re-check of a submitted transaction (no polling, no timers):
 * tx hash exists → a receipt becomes available later → the application
 * recognizes the transaction as confirmed.
 *
 * - pending  → no receipt observed yet; the pending record is kept.
 * - failed   → mined but unsuccessful; the pending record is discarded.
 * - confirmed → a real mined receipt exists. If this session still holds the
 *   pending issuance/revocation payload, the certificate is completed exactly
 *   like the normal success path (store + non-blocking Supabase insert) and
 *   returned; otherwise only the on-chain confirmation is reported (the chain
 *   remains the source of truth).
 */
export async function checkPendingTransaction(
  txHash: string,
): Promise<PendingTransactionCheck> {
  const clean = txHash.trim();
  const { state, receipt } = await getTransactionState(clean, fetchReceiptFromChain);
  const record = getPendingTransaction(clean);

  if (state === "pending") return { state, txHash: clean, certificate: null };

  if (state === "failed") {
    removePendingTransaction(clean);
    return { state, txHash: clean, certificate: null };
  }

  if (!record) {
    return { state, txHash: clean, certificate: null };
  }

  if (record.kind === "issuance") {
    const cert = buildIssuedCertificate({
      input: record.input,
      id: record.certificateId,
      hash: record.fingerprint,
      issuerWallet: record.issuerWallet,
      transactionHash: receipt.hash,
      block: receipt.blockNumber,
    });
    removePendingTransaction(clean);
    addToStore(cert);
    // Persist only now — the certificate has a real mined receipt.
    void saveCertificateToSupabase(cert, record.ipfsCid).catch(() => {});
    return { state, txHash: clean, certificate: cert };
  }

  // Revocation: flip the Supabase status only now that it is mined.
  removePendingTransaction(clean);
  await updateCertificateStatusInSupabase(record.certificateId, "revoked").catch(() => {});
  const updated = await fetchCertificateFromChain(record.certificateId);
  return { state, txHash: clean, certificate: updated };
}

// --- Forensic Analysis (for document upload verification) ---

export const FORENSIC_STAGES = [
  "Reading document",
  "Extracting certificate metadata",
  "Searching blockchain registry",
  "Comparing certificate fingerprint",
];

/**
 * Document upload verification (Method C).
 *
 * Two distinct hashes are involved and never compared to each other:
 * - documentByteHash: SHA-256 of the uploaded file's bytes (file integrity,
 *   reported for reference only — it is NOT the registry key).
 * - metadataFingerprint: SHA-256 of the canonical certificate metadata, the
 *   same fingerprint generated at issuance and anchored on-chain. The PDF's
 *   certificate ID is extracted, the stored metadata is re-hashed with the
 *   shared canonicalization, and the result is compared with the chain.
 */
export async function analyzeDocument(
  file: File,
  onStage?: (index: number) => void,
): Promise<ForensicResult> {
  onStage?.(0);

  const arrayBuffer = await file.arrayBuffer();
  const documentByteHash = `0x${await computeSHA256(new Uint8Array(arrayBuffer))}`;

  onStage?.(1);

  const extracted = extractCertificateMetadata(new Uint8Array(arrayBuffer));
  const certificateId = extracted.certificateId;

  if (!certificateId) {
    return {
      outcome: "not_found",
      documentByteHash,
      fields: [
        {
          label: "Certificate ID",
          document: "(not found in document)",
          registry: "NOT FOUND",
          match: false,
        },
        {
          label: "Document byte hash",
          document: shorten(documentByteHash, 10, 6),
          registry: "n/a — not the registry key",
          match: false,
        },
      ],
    };
  }

  onStage?.(2);

  let chainCert: Certificate | null = null;
  let registryCert: Certificate | null = null;
  try {
    chainCert = await fetchCertificateFromChain(certificateId);
    registryCert = await fetchCertificateFromSupabase(certificateId);
  } catch {
    chainCert = null;
    registryCert = null;
  }

  onStage?.(3);

  if (!chainCert) {
    return {
      outcome: "not_found",
      documentByteHash,
      fields: [
        {
          label: "Certificate ID",
          document: certificateId,
          registry: "NOT FOUND",
          match: false,
        },
        {
          label: "Document byte hash",
          document: shorten(documentByteHash, 10, 6),
          registry: "n/a — not the registry key",
          match: false,
        },
      ],
    };
  }

  if (!registryCert) {
    return {
      outcome: "not_found",
      documentByteHash,
      registeredHash: chainCert.hash,
      fields: [
        {
          label: "Certificate ID",
          document: certificateId,
          registry: certificateId,
          match: true,
        },
        {
          label: "Certificate fingerprint",
          document: "(metadata unavailable — cannot recompute)",
          registry: shorten(chainCert.hash, 10, 6),
          match: false,
        },
      ],
    };
  }

  // Fingerprint #1 (registry integrity): canonical metadata from Supabase
  // re-hashed with the shared protocol and compared against the chain anchor.
  const metadataFingerprint = await generateCertificateFingerprint({
    certificateId: registryCert.id,
    recipientName: registryCert.recipientName,
    course: registryCert.course,
    issueDate: registryCert.issueDate,
  });

  const onChainHash = chainCert.hash.toLowerCase();
  const registryFingerprintMatches = metadataFingerprint.toLowerCase() === onChainHash;

  // Field-level comparisons between the metadata EXTRACTED from the uploaded
  // document and the authoritative Supabase registry row. Missing extracted
  // fields never count as a match.
  const extractedDate = extracted.issueDate;
  const recipientMatches =
    extracted.recipientName !== null &&
    extracted.recipientName === registryCert.recipientName.trim();
  const courseMatches =
    extracted.course !== null && extracted.course === registryCert.course.trim();
  const dateMatches =
    extractedDate !== null &&
    normalizeIssueDate(extractedDate) === normalizeIssueDate(registryCert.issueDate);

  // Fingerprint #2 (document identity): the EXTRACTED metadata re-hashed with
  // the same canonical protocol and compared against the chain anchor. Only
  // computed when all four fields were extracted — incomplete metadata can
  // never produce a passing fingerprint.
  let documentFingerprint: string | null = null;
  if (
    extracted.complete &&
    extracted.certificateId &&
    extracted.recipientName &&
    extracted.course &&
    extracted.issueDate
  ) {
    documentFingerprint = (
      await generateCertificateFingerprint({
        certificateId: extracted.certificateId,
        recipientName: extracted.recipientName,
        course: extracted.course,
        issueDate: extracted.issueDate,
      })
    ).toLowerCase();
  }
  const documentFingerprintMatches =
    documentFingerprint !== null && documentFingerprint === onChainHash;

  const fields: ForensicField[] = [
    {
      label: "Certificate ID",
      document: extracted.certificateId || "(not extracted)",
      registry: registryCert.id,
      match: extracted.certificateId === registryCert.id,
    },
    {
      label: "Recipient",
      document: extracted.recipientName || "(not extracted)",
      registry: registryCert.recipientName,
      match: recipientMatches,
    },
    {
      label: "Course",
      document: extracted.course || "(not extracted)",
      registry: registryCert.course,
      match: courseMatches,
    },
    {
      label: "Issue Date",
      document: extractedDate || "(not extracted)",
      registry: normalizeIssueDate(registryCert.issueDate),
      match: dateMatches,
    },
    {
      label: "Certificate fingerprint",
      document: shorten(metadataFingerprint, 10, 6),
      registry: shorten(chainCert.hash, 10, 6),
      match: registryFingerprintMatches,
    },
    {
      label: "Document metadata fingerprint",
      document: documentFingerprint
        ? shorten(documentFingerprint, 10, 6)
        : "(incomplete metadata — cannot recompute)",
      registry: shorten(chainCert.hash, 10, 6),
      match: documentFingerprintMatches,
    },
  ];

  const fullyVerified =
    extracted.complete &&
    recipientMatches &&
    courseMatches &&
    dateMatches &&
    registryFingerprintMatches &&
    documentFingerprintMatches;

  return {
    outcome: fullyVerified ? "match" : "mismatch",
    documentByteHash,
    metadataFingerprint,
    registeredHash: chainCert.hash,
    certificate: { ...registryCert, status: chainCert.status },
    fields,
  };
}

// --- CSV Parsing (for bulk issuance) ---

export function parseCsv(text: string): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const rows: BulkRow[] = [];
  for (const line of lines.slice(1)) {
    const [name = "", email = "", course = "", date = "", type = ""] = line.split(",");
    const valid = Boolean(name && /.+@.+\..+/.test(email) && course && date);
    rows.push({
      name,
      email,
      course,
      date,
      type: type || "Completion",
      valid,
      ...(valid ? {} : { issue: !name ? "Missing name" : !email ? "Invalid email" : "Missing field" }),
    });
  }
  return rows;
}

// --- Add issued certificate to store ---
export function addToStore(cert: Certificate) {
  store.unshift(cert);
}
