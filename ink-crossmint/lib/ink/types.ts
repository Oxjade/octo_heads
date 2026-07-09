import type { Transaction } from "@mysten/sui/transactions";

export type InkSessionStatus = "idle" | "connecting" | "active" | "disconnected" | "error";
export type SigningMode = "wallet" | "ink-adapter" | "simulation";
export type ProofMode = "ika-mpc" | "signature" | "contract";
export type DWallet = {
  id: string;
  address?: `0x${string}`;
  privateKey?: `0x${string}`;
  createdAt: number;
  network: "monad";
  custody: "ika-mpc" | "browser-local-fallback";
  coordinator: "ika";
  dWalletCapId?: string;
  sessionIdentifier?: string;
  networkEncryptionKeyId?: string;
  userShareEncryptionKeys?: `0x${string}`;
  userSecretKeyShare?: `0x${string}`;
  userPublicOutput?: `0x${string}`;
};

export type InkUser = {
  id: string;
  suiAddress?: string;
  monadAddress?: string;
  sessionStatus: InkSessionStatus;
  signingMode: SigningMode;
};

export type SuiPaymentInput = {
  collectionId: string;
  packageId: string;
  monadAddressHash: string;
  proofUri: string;
};

export type SuiPaymentResult = {
  digest: string;
  objectId: string;
  mintNumber?: number;
  timestamp: number;
};

export type CrossChainProofInput = {
  suiObjectId: string;
  mintNumber: number;
  suiAddress: string;
  monadAddress: string;
};

export type CrossChainProof = {
  mode: ProofMode;
  suiObjectId: string;
  monadAddress: string;
  message: string;
  signature?: string;
  signer: "ika-dwallet" | "browser-wallet" | "local-fallback";
  proofHash: string;
  timestamp: number;
  claimDigest?: string;
  monadMintTxHash?: string;
  monadUnsignedTxHash?: string;
  status: "generated" | "claimed" | "simulated";
};

export type SuiTransactionSigner = (transaction: Transaction) => Promise<{
  digest?: string;
  effects?: unknown;
  objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }>;
}>;

export interface InkAdapter {
  connect(): Promise<InkUser>;
  disconnect(): Promise<void>;
  getUser(): InkUser | null;
  getSuiAddress(): string | undefined;
  getMonadAddress(): string | undefined;
  createDWallet(): Promise<DWallet>;
  signSuiTransaction(transaction: Transaction): Promise<unknown>;
  signMonadMessage(message: string): Promise<string>;
  acceptSuiPayment(input: SuiPaymentInput): Promise<SuiPaymentResult>;
  generateCrossChainProof(input: CrossChainProofInput): Promise<CrossChainProof>;
}
