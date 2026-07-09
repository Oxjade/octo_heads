import { NFTMintCard } from "@/components/NFTMintCard";
import { WalletStatusCard } from "@/components/WalletStatusCard";

export default function MintPage() {
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Mint Ink Genesis Pass</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
          Pay with Sui, then mint the NFT to a Monad dWallet through Ink + Ika coordination.
        </p>
      </div>
      <div className="mb-5">
        <WalletStatusCard />
      </div>
      <NFTMintCard />
    </main>
  );
}
