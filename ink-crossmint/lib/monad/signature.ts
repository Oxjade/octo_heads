import { keccak256, stringToBytes } from "viem";
import type { CrossChainProof, CrossChainProofInput } from "@/lib/ink/types";

export function buildProofMessage(input: CrossChainProofInput) {
  return `I paid for Ink Genesis Pass #${input.mintNumber} on Sui with receipt ${input.suiObjectId}. Mint the Monad NFT to ${input.monadAddress}.`;
}

export async function generateSignatureProof(
  input: CrossChainProofInput,
  signMessage: (message: string) => Promise<string>,
): Promise<CrossChainProof> {
  const message = buildProofMessage(input);
  const signature = await signMessage(message);
  const timestamp = Date.now();
  const proofHash = keccak256(stringToBytes(JSON.stringify({ message, signature, timestamp })));
  const signer = signature.startsWith("simulated-signature:")
    ? "local-fallback"
    : signature.startsWith("0x")
      ? "ika-dwallet"
      : "browser-wallet";

  return {
    mode: "signature",
    suiObjectId: input.suiObjectId,
    monadAddress: input.monadAddress,
    message,
    signature,
    signer,
    proofHash,
    timestamp,
    status: "generated",
  };
}
