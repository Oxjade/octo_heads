export const collectionConfig = {
  name: "Ink Genesis Pass",
  tagline: "Pay on Sui. NFT lives on Monad. Coordinated by Ink + Ika.",
  description:
    "A limited NFT minted to Monad after Sui payment, coordinated through Ink + Ika dWallet signing.",
  totalSupply: Number(process.env.NEXT_PUBLIC_COLLECTION_SUPPLY || 250),
  mintPrice: Number(process.env.NEXT_PUBLIC_MINT_PRICE || 1.5),
  mintPriceMist: Number(process.env.NEXT_PUBLIC_MINT_PRICE_MIST || 1_500_000_000),
  chainOfMint: "Monad",
  paymentChain: "Sui",
  packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ?? "",
  collectionId: process.env.NEXT_PUBLIC_SUI_COLLECTION_ID ?? "",
  imageUri: "ipfs://bafkreihqp7t3lq7d3hifchcfanwqm5ezjrrfexf5yom6cy66jg422naqfm",
  imageGatewayUrl:
    "https://blue-historical-mink-951.mypinata.cloud/ipfs/bafkreihqp7t3lq7d3hifchcfanwqm5ezjrrfexf5yom6cy66jg422naqfm",
};
