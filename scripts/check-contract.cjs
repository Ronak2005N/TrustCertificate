const { ethers } = require("ethers");

const RPC_URL = "https://polygon-amoy-bor-rpc.publicnode.com";
const CONTRACT_ADDRESS = "0x09921D25cB513793e17082Cce0fB4F520f0CDF50";
const DEPLOYER = "0x3e72b748a543DEc762a297F7304A04F980d7bC01";

const ABI = [
  "function isAuthorizedIssuer(address) view returns (bool)",
  "function superAdmin() view returns (address)",
  "function getCertificateCount() view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  const superAdmin = await contract.superAdmin();
  console.log("Super admin:", superAdmin);

  const isAuth = await contract.isAuthorizedIssuer(DEPLOYER);
  console.log("Deployer authorized:", isAuth);

  const count = await contract.getCertificateCount();
  console.log("Certificate count:", count.toString());
}

main().catch((err) => console.error("Error:", err.message));
