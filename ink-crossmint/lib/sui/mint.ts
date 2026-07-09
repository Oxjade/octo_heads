import { normalizeSuiAddress } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";
import { collectionConfig } from "@/config/collection";

const SUI_CLOCK_OBJECT_ID = "0x6";

export function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [];
}

export function buildSuiPaymentTransaction(input: {
  packageId: string;
  collectionId: string;
  monadAddressHash: string;
  proofUri: string;
}) {
  if (!input.packageId || !input.collectionId) {
    throw new Error("Minting is not live yet.");
  }

  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(collectionConfig.mintPriceMist)]);

  tx.moveCall({
    target: `${normalizeSuiAddress(input.packageId)}::ink_genesis_pass::mint`,
    arguments: [
      tx.object(input.collectionId),
      tx.object(SUI_CLOCK_OBJECT_ID),
      payment,
      tx.pure.vector("u8", hexToBytes(input.monadAddressHash)),
      tx.pure.string(input.proofUri),
    ],
  });

  return tx;
}

export function extractSuiPaymentReceiptId(result: {
  digest?: string;
}) {
  return result.digest ?? `pending-payment-${Date.now().toString(36)}`;
}
