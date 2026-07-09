import { collectionConfig } from "@/config/collection";

export type InkPassMetadataInput = {
  mintNumber: number;
  suiObjectId: string;
  monadAddressHash: string;
  proofUri: string;
};

export function buildInkPassMetadata(input: InkPassMetadataInput) {
  const padded = input.mintNumber.toString().padStart(3, "0");

  return {
    name: `Ink Genesis Pass #${padded}`,
    description: "An Ink Genesis Pass NFT minted on Monad after Sui payment coordination through Ink + Ika.",
    image: collectionConfig.imageGatewayUrl,
    attributes: [
      { trait_type: "NFT Chain", value: "Monad" },
      { trait_type: "Payment Chain", value: "Sui" },
      { trait_type: "Coordinated By", value: "Ink + Ika" },
      { trait_type: "Signing", value: "dWallet" },
      { trait_type: "Edition", value: "Genesis" },
    ],
    ink: {
      sdk: "Ink SDK",
      ika: "Ika dWallet coordination",
      website: "https://useink.xyz",
      session_type: "sui payment with monad receipt",
      sui_payment_receipt_id: input.suiObjectId,
      monad_address_hash: input.monadAddressHash,
      proof_uri: input.proofUri,
    },
    chains: {
      nft: "monad",
      payment: "sui",
    },
  };
}
