import { monadConfig } from "@/config/chains";
import type { CrossChainProof, CrossChainProofInput } from "@/lib/ink/types";
import { generateContractProof } from "./contract";
import { generateSignatureProof } from "./signature";

export function getMonadAddressHash(address: string) {
  if (!address) return "0x";
  const normalized = address.toLowerCase();
  const encoder = new TextEncoder();
  return `0x${Array.from(encoder.encode(normalized))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function generateMonadProof(
  input: CrossChainProofInput,
  signMessage: (message: string) => Promise<string>,
): Promise<CrossChainProof> {
  if (monadConfig.proofMode === "contract") {
    return generateContractProof(input);
  }

  return generateSignatureProof(input, signMessage);
}
