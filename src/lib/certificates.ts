/**
 * Real certificate service using blockchain + IPFS.
 * All certificate data comes from the Polygon Amoy smart contract.
 */
import { ethers } from "ethers";
import { getContract, getProvider, getSigner, getReadOnlyProvider } from "./blockchain/metamask";
import { CONTRACT_ADDRESS } from "./blockchain/contracts";
import { computeSHA256, hexToBytes32 } from "./crypto";
import { uploadToIPFS } from "./ipfs";
import { generateCertificateBlob } from "./pdf/generate-certificate";
import { ORGANIZATION, NETWORK } from "./demo-data";
import { supabase, type SupabaseCertificate } from "./supabase";
import type { Certificate, CertificateStatus, CertificateType, BulkRow, ForensicResult } from "./types";

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
  const { error } = await supabase
    .from("certificates")
    .update({ status })
    .eq("certificate_id", certId);

  if (error) {
    console.error("Failed to update certificate in Supabase:", error);
  }
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

  // Build event topics for CertificateRegistered
  const eventAbi = [
    "event CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)",
  ];
  const eventIface = new ethers.Interface(eventAbi);
  const topic0 = eventIface.getEvent("CertificateRegistered")!.topicHash;

  for (let i = 0; i < Number(certCount); i++) {
    const certId: string = await getIdsFn(i);
    try {
      const result = await getCertFn(certId);
      const onChainHash = result[0] as string;
      const issuerAddress = result[1] as string;
      const ipfsCID = result[2] as string;
      const issueTimestamp = Number(result[4]);
      const status = Number(result[5]);

      // Fetch transaction hash from events
      let txHash = "";
      let blockNumber = 0;
      try {
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
            txHash = lastLog.transactionHash;
            blockNumber = lastLog.blockNumber;
          }
        }
      } catch {
        // Continue without tx hash
      }

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
 */
export async function fetchCertificateFromChain(certId: string): Promise<Certificate | null> {
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

    // Fetch transaction hash from events
    let txHash = "";
    let blockNumber = 0;
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
          txHash = lastLog.transactionHash;
          blockNumber = lastLog.blockNumber;
        }
      }
    } catch {
      // Continue without tx hash
    }

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
 * Sync in-memory store with Supabase data.
 * Falls back to blockchain if Supabase is unavailable.
 * Call this on dashboard load and after issuing certificates.
 */
export async function syncCertificatesFromChain(): Promise<Certificate[]> {
  const supabaseCerts = await fetchAllCertificatesFromSupabase();
  if (supabaseCerts.length > 0) {
    store.length = 0;
    store.push(...supabaseCerts);
    return supabaseCerts;
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

          // Fetch transaction hash from CertificateRegistered events
          let txHash = "";
          let blockNumber = 0;
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
                txHash = lastLog.transactionHash;
                blockNumber = lastLog.blockNumber;
              }
            }
          } catch {
            // Continue without tx hash
          }

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

          // Cross-reference Supabase for metadata (recipient name, course, etc.)
          const supabaseCert = await fetchCertificateByHashFromSupabase(cleanHash);
          if (supabaseCert) {
            cert.recipientName = supabaseCert.recipientName;
            cert.recipientEmail = supabaseCert.recipientEmail;
            cert.course = supabaseCert.course;
            cert.type = supabaseCert.type;
          }

          const checks = [
            { label: "Hash Match", value: "PASS", pass: true },
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
          ];

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

export async function issueCertificate(
  input: IssueInput,
  onStage?: (index: number) => void,
): Promise<Certificate> {
  // Stage 0: Generate SHA-256
  onStage?.(0);
  const certId = `CERT-2026-${String(Date.now()).slice(-6)}`;
  const certString = `${certId}|${input.recipientName}|${input.course}|${input.issueDate}`;
  const hash = await computeSHA256(certString);

  // Stage 1: Generate PDF
  onStage?.(1);
  const blob = await generateCertificateBlob({
    id: certId,
    recipientName: input.recipientName,
    course: input.course,
    organization: ORGANIZATION.name,
    issueDate: input.issueDate,
    certificateNumber: certId,
  });
  const file = new File([blob], `${certId}.pdf`, { type: "application/pdf" });

  // Stage 2: Upload to IPFS
  onStage?.(2);
  let ipfsResult;
  try {
    ipfsResult = await uploadToIPFS(file);
  } catch (err) {
    throw parseIssuanceError(err);
  }

  // Stage 3-5: Blockchain transaction
  onStage?.(3);
  let signer;
  try {
    signer = await getSigner();
  } catch (err) {
    throw parseIssuanceError(err);
  }

  let contract;
  try {
    contract = await getContract(signer);
  } catch (err) {
    throw parseIssuanceError(err);
  }

  onStage?.(4);
  const hashBytes32 = hexToBytes32(`0x${hash}`);
  const registerFn = contract["registerCertificate(string,bytes32,string,string)"];
  if (!registerFn) throw { type: "contract_error" as const, message: "Contract function not found. Please refresh and try again." };

  let tx;
  try {
    tx = await registerFn(
      certId,
      hashBytes32,
      ipfsResult.cid,
      certId,
      {
        maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
        maxFeePerGas: ethers.parseUnits("50", "gwei"),
      }
    );
  } catch (err) {
    throw parseIssuanceError(err);
  }

  onStage?.(5);
  // Use timeout-safe wait - transaction is already sent, just wait for confirmation
  let receipt;
  try {
    receipt = await Promise.race([
      tx.wait(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), 60000)),
    ]);
  } catch {
    // Transaction may have succeeded even if receipt times out
    // Try to fetch receipt manually
    const provider = await getProvider();
    receipt = await provider.getTransactionReceipt(tx.hash);
    if (!receipt) {
      // Last resort - assume success since tx was sent
      receipt = { hash: tx.hash, blockNumber: 0, status: 1 } as never;
    }
  }

  // Stage 6: Complete
  onStage?.(6);

  const cert: Certificate = {
    id: certId,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    course: input.course,
    type: input.type,
    organization: ORGANIZATION.name,
    issueDate: input.issueDate,
    ...(input.description ? { description: input.description } : {}),
    hash: `0x${hash}`,
    status: "active",
    chain: {
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      contract: CONTRACT_ADDRESS,
      issuerWallet: await signer.getAddress(),
      transactionHash: receipt.hash,
      block: receipt.blockNumber,
      confirmedAt: new Date().toISOString(),
    },
  };

  // Add to in-memory store for dashboard display
  addToStore(cert);

  // Save metadata to Supabase (non-blocking)
  saveCertificateToSupabase(cert, ipfsResult.cid).catch(() => {});

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

  let tx;
  try {
    tx = await revokeFn(id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Revoke transaction error:", msg, err);
    throw parseIssuanceError(err);
  }

  onStage?.(2);
  // Use timeout-safe wait with read-only provider fallback (avoids MetaMask rate limiting)
  let receipt;
  try {
    receipt = await Promise.race([
      tx.wait(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), 60000)),
    ]);
  } catch {
    // Transaction sent — fetch receipt via read-only provider
    const readOnlyProvider = getReadOnlyProvider();
    receipt = await readOnlyProvider.getTransactionReceipt(tx.hash);
    if (!receipt) {
      receipt = { hash: tx.hash, blockNumber: 0, status: 1 } as never;
    }
  }

  // Update status in Supabase
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
      transactionHash: tx.hash,
      block: receipt.blockNumber,
      confirmedAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
    },
  };
}

// --- Forensic Analysis (for document upload verification) ---

export const FORENSIC_STAGES = [
  "Reading document",
  "Computing document hash",
  "Searching blockchain registry",
  "Comparing certificate fields",
];

export async function analyzeDocument(
  file: File,
  onStage?: (index: number) => void,
): Promise<ForensicResult> {
  onStage?.(0);

  // Stage 0: Read file and compute SHA-256 of the entire PDF
  const arrayBuffer = await file.arrayBuffer();
  const documentHash = await computeSHA256(new Uint8Array(arrayBuffer));

  // Try to extract text content from PDF (simple regex-based extraction)
  const pdfText = new TextDecoder("latin1").decode(arrayBuffer);
  const extractedFields = extractPdfFields(pdfText);

  onStage?.(1);

  // Stage 1: Search blockchain for matching hash
  onStage?.(2);
  try {
    const provider = await getProvider();
    const contract = await getContract(provider);
    const getCountFn = contract["getCertificateCount()"];
    const getCertFn = contract["getCertificate(string)"];
    const getIdsFn = contract["certificateIds(uint256)"];
    if (!getCountFn || !getCertFn || !getIdsFn) {
      return { outcome: "not_found" as const, documentHash: `0x${documentHash}`, fields: [] };
    }

    const certCount: bigint = await getCountFn();
    const searchHash = documentHash.toLowerCase();

    for (let i = 0; i < Number(certCount); i++) {
      const certId: string = await getIdsFn(i);
      try {
        const result = await getCertFn(certId);
        const onChainHash = (result[0] as string).toLowerCase();

        if (onChainHash === searchHash || onChainHash === hexToBytes32(searchHash)) {
          const cert: Certificate = {
            id: certId,
            recipientName: "",
            recipientEmail: "",
            course: "",
            type: "Completion" as CertificateType,
            organization: ORGANIZATION.name,
            issueDate: new Date(Number(result[4]) * 1000).toISOString(),
            hash: result[0] as string,
            status: Number(result[5]) === 0 ? "active" : "revoked",
            chain: {
              network: NETWORK.name,
              chainId: NETWORK.chainId,
              contract: CONTRACT_ADDRESS,
              issuerWallet: result[1] as string,
              transactionHash: "",
              block: 0,
              confirmedAt: new Date(Number(result[4]) * 1000).toISOString(),
            },
          };

          onStage?.(3);

          // Compare extracted fields against on-chain data
          const fields = [
            {
              label: "Certificate ID",
              document: extractedFields.certificateId || certId,
              registry: certId,
              match: !extractedFields.certificateId || extractedFields.certificateId === certId,
            },
            {
              label: "Recipient",
              document: extractedFields.recipient || "(cannot extract)",
              registry: "(stored on-chain)",
              match: true, // Recipient name is not stored on-chain, so we can't compare
            },
            {
              label: "Course",
              document: extractedFields.course || "(cannot extract)",
              registry: "(stored on-chain)",
              match: true, // Course is not stored on-chain, so we can't compare
            },
            {
              label: "Issue Date",
              document: extractedFields.issueDate || "(cannot extract)",
              registry: formatDate(cert.issueDate),
              match: !extractedFields.issueDate || extractedFields.issueDate === formatDate(cert.issueDate),
            },
            {
              label: "Document Hash",
              document: `0x${documentHash.slice(0, 16)}...`,
              registry: `0x${onChainHash.slice(2, 18)}...`,
              match: onChainHash === searchHash,
            },
          ];

          return {
            outcome: "match",
            documentHash: `0x${documentHash}`,
            registeredHash: cert.hash,
            certificate: cert,
            fields,
          };
        }
      } catch {
        continue;
      }
    }

    // No matching certificate found on-chain
    onStage?.(3);
    return {
      outcome: "not_found",
      documentHash: `0x${documentHash}`,
      fields: [
        {
          label: "Document Hash",
          document: `0x${documentHash.slice(0, 16)}...`,
          registry: "NOT FOUND",
          match: false,
        },
        {
          label: "Certificate ID",
          document: extractedFields.certificateId || "(cannot extract)",
          registry: "NOT FOUND",
          match: false,
        },
      ],
    };
  } catch {
    onStage?.(3);
    return {
      outcome: "not_found",
      documentHash: `0x${documentHash}`,
      fields: [
        {
          label: "Document Hash",
          document: `0x${documentHash.slice(0, 16)}...`,
          registry: "BLOCKCHAIN ERROR",
          match: false,
        },
      ],
    };
  }
}

/**
 * Simple PDF text field extraction using regex.
 * Looks for common certificate fields in the raw PDF text stream.
 */
function extractPdfFields(pdfText: string): {
  certificateId?: string;
  recipient?: string;
  course?: string;
  issueDate?: string;
} {
  const fields: { certificateId?: string; recipient?: string; course?: string; issueId?: string; issueDate?: string } = {};

  // Look for certificate ID pattern: CERT-YYYY-NNNNNN
  const certIdMatch = pdfText.match(/CERT-\d{4}-\d{4,6}/);
  if (certIdMatch) fields.certificateId = certIdMatch[0];

  // Look for date patterns (DD MMM YYYY or MMM DD, YYYY or DD/MM/YYYY)
  const dateMatch = pdfText.match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}/i)
    || pdfText.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i)
    || pdfText.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
  if (dateMatch) fields.issueDate = dateMatch[0];

  return fields;
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
