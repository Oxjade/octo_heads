import { createWalletClient, custom, getContract, http, keccak256, stringToBytes } from "viem";
import type { CrossChainProof, CrossChainProofInput } from "@/lib/ink/types";
import { monadConfig } from "@/config/chains";
import { buildProofMessage } from "./signature";

export const inkPassClaimAbi = [
  {
    type: "function",
    name: "claimInkPass",
    stateMutability: "nonpayable",
    inputs: [
      { name: "suiObjectId", type: "string" },
      { name: "proofHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "InkPassClaimed",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "suiObjectId", type: "string" },
      { indexed: false, name: "proofHash", type: "bytes32" },
    ],
  },
] as const;

export async function generateContractProof(input: CrossChainProofInput): Promise<CrossChainProof> {
  const message = buildProofMessage(input);
  const proofHash = keccak256(stringToBytes(message));
  const timestamp = Date.now();

  if (!monadConfig.claimContractAddress || typeof window === "undefined" || !window.ethereum) {
    return {
      mode: "contract",
      suiObjectId: input.suiObjectId,
      monadAddress: input.monadAddress,
      message,
      proofHash,
      timestamp,
      signer: "local-fallback",
      status: "simulated",
    };
  }

  const walletClient = createWalletClient({
    chain: {
      id: monadConfig.chainId,
      name: "Monad",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [monadConfig.rpcUrl] } },
    },
    transport: typeof window !== "undefined" && window.ethereum ? custom(window.ethereum) : http(monadConfig.rpcUrl),
  });

  const [account] = await walletClient.requestAddresses();
  const contract = getContract({
    address: monadConfig.claimContractAddress as `0x${string}`,
    abi: inkPassClaimAbi,
    client: walletClient,
  });
  const claimDigest = await contract.write.claimInkPass([input.suiObjectId, proofHash], { account });

  return {
    mode: "contract",
    suiObjectId: input.suiObjectId,
    monadAddress: input.monadAddress,
    message,
    proofHash,
    signer: "browser-wallet",
    timestamp,
    claimDigest,
    status: "claimed",
  };
}
