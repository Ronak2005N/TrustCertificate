const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const RPC_URL = "https://polygon-amoy.drpc.org";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const EXPLORER = "https://amoy.polygonscan.com";

// Load compiled artifact
const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "CertChainRegistry.sol", "CertChainRegistry.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

async function main() {
  if (!PRIVATE_KEY) {
    console.error("DEPLOYER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  console.log("Connecting to Polygon Amoy...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} POL`);

  if (balance === 0n) {
    console.error("Insufficient POL for deployment");
    process.exit(1);
  }

  console.log("Deploying CertChainRegistry...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nContract deployed successfully!`);
  console.log(`Address: ${address}`);
  console.log(`Explorer: ${EXPLORER}/address/${address}`);

  // Verify deployment
  const superAdmin = await contract.superAdmin();
  console.log(`Super Admin: ${superAdmin}`);

  const isIssuer = await contract.isAuthorizedIssuer(wallet.address);
  console.log(`Deployer is authorized issuer: ${isIssuer}`);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: address,
    network: "Polygon Amoy",
    chainId: 80002,
    deployer: wallet.address,
    explorer: `${EXPLORER}/address/${address}`,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment.json");

  // Update .env with contract address
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = fs.readFileSync(envPath, "utf8");
  envContent = envContent.replace(
    /VITE_CONTRACT_ADDRESS=.*/,
    `VITE_CONTRACT_ADDRESS=${address}`
  );
  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env with contract address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
