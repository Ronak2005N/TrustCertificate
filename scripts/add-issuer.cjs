// Script to add an authorized issuer to the CertChainRegistry contract
// Usage: node scripts/add-issuer.cjs <wallet-address>

const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// Load .env
const envPath = path.resolve(__dirname, "...env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const [key, ...valueParts] = trimmed.split("=");
  env[key.trim()] = valueParts.join("=").trim();
});

const RPC_URL = "https://polygon-amoy-bor-rpc.publicnode.com";
const CONTRACT_ADDRESS = env.VITE_CONTRACT_ADDRESS;
const PRIVATE_KEY = env.DEPLOYER_PRIVATE_KEY;

const ABI = [
  "function addIssuer(address wallet)",
  "function isAuthorizedIssuer(address wallet) view returns (bool)",
  "function superAdmin() view returns (address)",
];

async function main() {
  const walletAddress = process.argv[2];
  if (!walletAddress) {
    console.log("Usage: node scripts/add-issuer.cjs <wallet-address>");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  console.log("Deployer wallet:", wallet.address);
  console.log("Adding issuer:", walletAddress);

  // Check if already authorized
  const alreadyAuthorized = await contract.isAuthorizedIssuer(walletAddress);
  if (alreadyAuthorized) {
    console.log("Wallet is already authorized!");
    process.exit(0);
  }

  const tx = await contract.addIssuer(walletAddress);
  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  console.log("Done! Wallet is now authorized as an issuer.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
