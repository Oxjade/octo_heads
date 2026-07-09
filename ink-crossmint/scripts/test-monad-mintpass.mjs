import { encodeFunctionData, isHex, keccak256, stringToHex } from "viem";

const receiptContract = process.env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT;
const recipient = "0x0000000000000000000000000000000000000001";
const suiReceiptId = "0x_sui_receipt_demo";
const proofHash = keccak256(stringToHex("ink-ika-monad-mintpass"));

const calldata = encodeFunctionData({
  abi: [
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
  ],
  functionName: "mintPass",
  args: [recipient, suiReceiptId, proofHash],
});

if (!isHex(calldata) || calldata.slice(0, 10) !== "0xaf95746c") {
  throw new Error(`Unexpected mintPass calldata: ${calldata}`);
}

console.log(`mintPass calldata OK: ${calldata.slice(0, 18)}...`);
console.log(`Monad receipt contract configured: ${receiptContract ? "yes" : "no"}`);
