import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  isMetaMaskInstalled,
  connectWallet,
  getBalance,
  getChainId,
  switchToAmoy,
  listenToAccounts,
  listenToChain,
  removeListeners,
  isConnectedToAmoy,
} from "@/lib/blockchain/metamask";
import { POLYGON_AMOY } from "@/lib/blockchain/contracts";
import type { WalletState } from "@/lib/blockchain/types";

interface WalletContextType extends WalletState {
  isMetaMaskInstalled: boolean;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  shortenAddress: (addr: string) => string;
  refreshBalance: () => Promise<void>;
  isConnecting: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    address: "",
    chainId: 0,
    balance: "0",
    isConnected: false,
    isAmoy: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shortenAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const refreshBalance = useCallback(async () => {
    if (wallet.address) {
      const bal = await getBalance(wallet.address);
      setWallet((prev) => ({ ...prev, balance: bal }));
    }
  }, [wallet.address]);

  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError("Please install MetaMask to continue.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const address = await connectWallet();
      const chainId = await getChainId();
      const balance = await getBalance(address);
      const isAmoy = chainId === POLYGON_AMOY.chainId;

      setWallet({ address, chainId, balance, isConnected: true, isAmoy });

      if (!isAmoy) {
        setError("Wrong network. Please switch to Polygon Amoy.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToAmoy();
      const chainId = await getChainId();
      setWallet((prev) => ({ ...prev, chainId, isAmoy: chainId === POLYGON_AMOY.chainId }));
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to switch network";
      setError(message);
    }
  }, []);

  // Auto-connect if previously connected
  useEffect(() => {
    if (isMetaMaskInstalled()) {
      window.ethereum!.request({ method: "eth_accounts" }).then((accounts) => {
        if (accounts && (accounts as string[]).length > 0) {
          connect();
        }
      });
    }
  }, [connect]);

  // Listen for account/chain changes
  useEffect(() => {
    listenToAccounts((accounts: string[]) => {
      if (accounts.length === 0) {
        setWallet({ address: "", chainId: 0, balance: "0", isConnected: false, isAmoy: false });
      } else {
        connect();
      }
    });

    listenToChain(() => {
      connect();
    });

    return () => {
      removeListeners();
    };
  }, [connect]);

  return (
    <WalletContext.Provider
      value={{
        ...wallet,
        isMetaMaskInstalled: isMetaMaskInstalled(),
        connect,
        switchNetwork,
        shortenAddress,
        refreshBalance,
        isConnecting,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
