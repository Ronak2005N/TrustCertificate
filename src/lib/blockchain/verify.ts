import { getContract, getProvider } from "./metamask";

export interface OnChainCertificate {
  certificateHash: string;
  issuerAddress: string;
  ipfsCID: string;
  certificateNumber: string;
  issueTimestamp: number;
  status: number;
}

export async function verifyOnChain(
  certificateId: string
): Promise<OnChainCertificate | null> {
  try {
    const contract = await getContract(await getProvider());
    const fn = contract["getCertificate(string)"];
    if (!fn) return null;
    const result = await fn(certificateId);

    return {
      certificateHash: result[0] as string,
      issuerAddress: result[1] as string,
      ipfsCID: result[2] as string,
      certificateNumber: result[3] as string,
      issueTimestamp: Number(result[4]),
      status: Number(result[5]),
    };
  } catch {
    return null;
  }
}

export async function compareHash(
  localHash: string,
  onChainHash: string
): Promise<boolean> {
  return localHash.toLowerCase() === onChainHash.toLowerCase();
}

export async function checkIssuerAuth(
  walletAddress: string
): Promise<boolean> {
  try {
    const contract = await getContract(await getProvider());
    const fn = contract["isAuthorizedIssuer(address)"];
    if (!fn) return false;
    return await fn(walletAddress);
  } catch {
    return false;
  }
}

export async function certificateExists(
  certificateId: string
): Promise<boolean> {
  try {
    const contract = await getContract(await getProvider());
    const fn = contract["certificateExists(string)"];
    if (!fn) return false;
    return await fn(certificateId);
  } catch {
    return false;
  }
}

export function computeStatus(
  cert: OnChainCertificate | null,
  hashMatch: boolean,
  issuerAuthorized: boolean
): "VERIFIED" | "INVALID" | "REVOKED" | "NOT_FOUND" | "UNAUTHORIZED_ISSUER" {
  if (!cert) return "NOT_FOUND";
  if (cert.status === 1) return "REVOKED";
  if (!issuerAuthorized) return "UNAUTHORIZED_ISSUER";
  if (!hashMatch) return "INVALID";
  return "VERIFIED";
}
