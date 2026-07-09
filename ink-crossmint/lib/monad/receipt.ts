import { encodeFunctionData, type Hex } from "viem";

export const inkPassReceiptAbi = [
  {
    type: "function",
    name: "mintPass",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "suiReceiptId", type: "string" },
      { name: "proofHash", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export function buildMonadReceiptMintCalldata(input: {
  monadAddress: `0x${string}`;
  suiReceiptId: string;
  proofHash: Hex;
}) {
  return encodeFunctionData({
    abi: inkPassReceiptAbi,
    functionName: "mintPass",
    args: [input.monadAddress, input.suiReceiptId, input.proofHash],
  });
}
