import { ethers } from "ethers";
import { POLYGON_AMOY, CONTRACT_ADDRESS, CERT_CHAIN_REGISTRY_ABI } from "./contracts";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function isMetaMaskInstalled(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.ethereum !== "undefined" &&
    !!window.ethereum.isMetaMask
  );
}

export async function connectWallet(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found. Please unlock MetaMask.");
  }

  return accounts[0] as string;
}

export async function getProvider(): Promise<ethers.BrowserProvider> {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }
  return new ethers.BrowserProvider(window.ethereum!);
}

/**
 * Get a read-only JSON-RPC provider for public verification.
 * Does NOT require MetaMask. Works for any visitor.
 */
export function getReadOnlyProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(POLYGON_AMOY.rpcUrl);
}

export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getContract(signerOrProvider?: ethers.Signer | ethers.Provider): Promise<ethers.Contract> {
  const signer = signerOrProvider || (await getSigner());
  return new ethers.Contract(CONTRACT_ADDRESS, CERT_CHAIN_REGISTRY_ABI, signer);
}

export async function switchToAmoy(): Promise<void> {
  if (!isMetaMaskInstalled()) throw new Error("MetaMask not installed");

  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_AMOY.chainIdHex }],
    });
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 4902) {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: POLYGON_AMOY.chainIdHex,
            chainName: POLYGON_AMOY.name,
            nativeCurrency: {
              name: POLYGON_AMOY.currency,
              symbol: POLYGON_AMOY.currency,
              decimals: 18,
            },
            rpcUrls: [POLYGON_AMOY.rpcUrl],
            blockExplorerUrls: [POLYGON_AMOY.explorerUrl],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export async function getBalance(address: string): Promise<string> {
  const provider = await getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export async function getChainId(): Promise<number> {
  const provider = await getProvider();
  const network = await provider.getNetwork();
  return Number(network.chainId);
}

export async function isConnectedToAmoy(): Promise<boolean> {
  try {
    const chainId = await getChainId();
    return chainId === POLYGON_AMOY.chainId;
  } catch {
    return false;
  }
}

export function listenToAccounts(callback: (accounts: string[]) => void): void {
  window.ethereum?.on("accountsChanged", (...args: unknown[]) => {
    callback(args[0] as string[]);
  });
}

export function listenToChain(callback: (chainId: string) => void): void {
  window.ethereum?.on("chainChanged", (...args: unknown[]) => {
    callback(args[0] as string);
  });
}

export function removeListeners(): void {
  window.ethereum?.removeListener("accountsChanged", () => {});
  window.ethereum?.removeListener("chainChanged", () => {});
}
