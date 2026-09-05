export interface WalletState {
  address: string;
  chainId: number;
  balance: string;
  isConnected: boolean;
  isAmoy: boolean;
}

export interface TransactionResult {
  hash: string;
  blockNumber: number;
  gasUsed: bigint;
  status: number;
}
