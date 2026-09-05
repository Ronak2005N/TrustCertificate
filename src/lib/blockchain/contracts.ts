export const CERT_CHAIN_REGISTRY_ABI = [
  "constructor()",
  "function superAdmin() view returns (address)",
  "function authorizedIssuers(address) view returns (bool)",
  "function certificates(string) view returns (bytes32 certificateHash, address issuerAddress, string ipfsCID, string certificateNumber, uint256 issueTimestamp, uint256 status)",
  "function certificateIds(uint256) view returns (string)",
  "function issuerList(uint256) view returns (address)",
  "function addIssuer(address wallet)",
  "function removeIssuer(address wallet)",
  "function isAuthorizedIssuer(address wallet) view returns (bool)",
  "function registerCertificate(string certificateId, bytes32 certificateHash, string ipfsCID, string certificateNumber)",
  "function getCertificate(string certificateId) view returns (bytes32 certificateHash, address issuerAddress, string ipfsCID, string certificateNumber, uint256 issueTimestamp, uint256 status)",
  "function certificateExists(string certificateId) view returns (bool)",
  "function revokeCertificate(string certificateId)",
  "function getCertificateStatus(string certificateId) view returns (uint256)",
  "function getCertificateCount() view returns (uint256)",
  "function getIssuerCount() view returns (uint256)",
  "event IssuerAdded(address indexed issuer, uint256 timestamp)",
  "event IssuerRemoved(address indexed issuer, uint256 timestamp)",
  "event CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)",
  "event CertificateRevoked(string indexed certificateId, uint256 timestamp)",
] as const;

export const POLYGON_AMOY = {
  chainId: 80002,
  chainIdHex: "0x13882",
  name: "Polygon Amoy",
  currency: "POL",
  rpcUrl: "https://polygon-amoy-bor-rpc.publicnode.com",
  explorerUrl: "https://amoy.polygonscan.com",
};

const env = import.meta.env as Record<string, string | undefined>;

export const CONTRACT_ADDRESS: string = env["VITE_CONTRACT_ADDRESS"] || "";

export const EXPLORER_URL: string = env["VITE_EXPLORER_URL"] || POLYGON_AMOY.explorerUrl;
