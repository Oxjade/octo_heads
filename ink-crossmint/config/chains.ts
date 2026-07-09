import { getFullnodeUrl, type SuiClient } from "@mysten/sui/client";

export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";
export type MonadProofMode = "signature" | "contract";

export const suiNetwork = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as SuiNetwork;

export const suiRpcUrl =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ||
  process.env.SUI_RPC_URL ||
  (suiNetwork === "localnet"
    ? "http://127.0.0.1:9000"
    : getFullnodeUrl(suiNetwork === "mainnet" ? "mainnet" : suiNetwork === "devnet" ? "devnet" : "testnet"));

export const suiGraphqlUrl = process.env.NEXT_PUBLIC_SUI_GRAPHQL_URL ?? process.env.SUI_GRAPHQL_URL ?? "";

export const monadConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz/",
  chainId: Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || 10143),
  proofMode: (process.env.NEXT_PUBLIC_MONAD_PROOF_MODE ?? "signature") as MonadProofMode,
  claimContractAddress: process.env.NEXT_PUBLIC_MONAD_CLAIM_CONTRACT ?? "",
  receiptContractAddress: process.env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT ?? "",
};

export type SuiClientLike = Pick<SuiClient, "getObject" | "queryEvents">;
