"use client";

import { useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { isAddress, keccak256, stringToBytes } from "viem";
import { BadgeCheck, Coins, Copy, ExternalLink, Fingerprint, KeyRound } from "lucide-react";
import { collectionConfig } from "@/config/collection";
import { monadConfig } from "@/config/chains";
import { ikaRuntimeConfig, requireIkaMintSigner } from "@/config/ika";
import { createInkAdapter } from "@/lib/ink/InkAdapter";
import type { DWallet } from "@/lib/ink/types";
import type { StoredMint } from "@/lib/storage/localStore";
import { saveStoredMint } from "@/lib/storage/localStore";
import { buildInkPassMetadata } from "@/lib/metadata/buildMetadata";
import { uploadMetadata } from "@/lib/metadata/uploadMetadata";
import { buildIkaDWalletDkgTransaction, buildIkaMonadMintPassSignTransaction, buildIkaPresignTransaction, submitCompletedIkaMintPassSignature } from "@/lib/ika/mpc";
import { getMonadAddressHash } from "@/lib/monad/proof";
import { Button, Panel, Stat } from "./ui";
import { defaultTimelineLabels, TimelineStep, TransactionTimeline } from "./TransactionTimeline";
import { MintSuccessModal } from "./MintSuccessModal";

function createSteps(activeIndex = -1, failedIndex = -1, error?: string): TimelineStep[] {
  return defaultTimelineLabels.map((label, index) => ({
    label,
    state: failedIndex === index ? "failed" : index < activeIndex ? "completed" : index === activeIndex ? "active" : "pending",
    error: failedIndex === index ? error : undefined,
  }));
}

function findCreatedObjectId(
  result: { objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }> },
  typeName: string,
) {
  return result.objectChanges?.find((change) => {
    if (change.type !== "created" || !change.objectType) return false;
    return change.objectType.endsWith(`::${typeName}`) || change.objectType.includes(`::${typeName}<`);
  })?.objectId;
}

function suiExplorerUrl(objectId: string) {
  return `https://testnet.suivision.xyz/object/${objectId}`;
}

function monadExplorerUrl(address: string) {
  return `https://testnet.monadexplorer.com/address/${address}`;
}

function ExplorerLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      className="group rounded-lg border border-line bg-bg/45 p-4 transition hover:border-primary/70 hover:bg-surface-2 focus-visible:outline-primary"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span className="flex items-center justify-between gap-3 text-xs font-medium text-muted">
        {label}
        <ExternalLink size={14} className="shrink-0 transition group-hover:text-primary" />
      </span>
      <span className="mt-2 block break-all text-sm font-semibold text-ink">{value}</span>
    </a>
  );
}

export function NFTMintCard() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction<{
    digest: string;
    rawEffects?: number[];
    objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }>;
  }>({
    execute: async ({ bytes, signature }) => {
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showObjectChanges: true,
          showEffects: true,
        },
      });

      return {
        digest: result.digest,
        rawEffects: result.rawEffects,
        objectChanges: result.objectChanges as Array<{ type: string; objectId?: string; objectType?: string }> | undefined,
      };
    },
  });
  const [steps, setSteps] = useState<TimelineStep[]>(() => createSteps());
  const [isMinting, setIsMinting] = useState(false);
  const [mintedCount, setMintedCount] = useState(0);
  const [monadAddress, setMonadAddress] = useState("");
  const [dwallet, setDWallet] = useState<DWallet | undefined>();
  const [privateKeyCopied, setPrivateKeyCopied] = useState(false);
  const [lastMint, setLastMint] = useState<StoredMint | undefined>();
  const [error, setError] = useState<string | undefined>();

  const nextMintNumber = useMemo(() => mintedCount + 1, [mintedCount]);
  const ikaMintReady = Boolean(
    ikaRuntimeConfig.ikaCoinObjectId &&
      ikaRuntimeConfig.dWalletId &&
      ikaRuntimeConfig.dWalletCapId &&
      ikaRuntimeConfig.dWalletEvmAddress,
  );
  const configured = Boolean(collectionConfig.packageId && collectionConfig.collectionId && monadConfig.receiptContractAddress && ikaMintReady);

  async function createDWallet() {
    setError(undefined);

    if (!account?.address) {
      setError("Connect a Sui wallet before creating an Ika dWallet.");
      return;
    }

    try {
      const dkg = await buildIkaDWalletDkgTransaction({
        suiClient,
        senderAddress: account.address,
      });
      const result = await signAndExecuteTransaction({ transaction: dkg.transaction });
      const dWalletCapId = findCreatedObjectId(result, "DWalletCap");
      const generated: DWallet = {
        id: findCreatedObjectId(result, "DWallet") ?? dkg.sessionIdentifier,
        dWalletCapId,
        createdAt: Date.now(),
        network: "monad",
        custody: "ika-mpc",
        coordinator: "ika",
        sessionIdentifier: dkg.sessionIdentifier,
        networkEncryptionKeyId: dkg.networkEncryptionKeyId,
        userShareEncryptionKeys: dkg.userShareEncryptionKeys,
        userSecretKeyShare: dkg.userSecretKeyShare,
        userPublicOutput: dkg.userPublicOutput,
      };
      setDWallet(generated);
      setPrivateKeyCopied(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ika dWallet DKG request failed.");
    }
  }

  async function copyPrivateKey() {
    if (!dwallet?.privateKey) return;
    await navigator.clipboard.writeText(dwallet.privateKey);
    setPrivateKeyCopied(true);
  }

  async function runMint() {
    setError(undefined);

    if (!account?.address) {
      setError("Connect a Sui wallet before minting.");
      return;
    }

    if (!isAddress(monadAddress)) {
      setError("Enter a valid Monad wallet address.");
      return;
    }

    setIsMinting(true);
    setSteps(createSteps(0));

    try {
      const adapter = createInkAdapter({
        suiAddress: account.address,
        monadAddress,
        dwalletPrivateKey: dwallet?.privateKey,
        signSuiTransaction: async (transaction) => {
          setSteps(createSteps(2));
          const result = await signAndExecuteTransaction({
            transaction,
          });
          return result;
        },
      });

      const user = await adapter.connect();
      setSteps(createSteps(1));

      const targetMonadAddress = user.monadAddress ?? monadAddress;
      const monadAddressHash = getMonadAddressHash(targetMonadAddress);
      const pendingProofUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://useink.xyz"}/proofs/pending/${Date.now()}`;

      setSteps(createSteps(3));
      const mint = await adapter.acceptSuiPayment({
        packageId: collectionConfig.packageId,
        collectionId: collectionConfig.collectionId,
        monadAddressHash,
        proofUri: pendingProofUri,
      });
      setSteps(createSteps(4));

      const mintNumber = mint.mintNumber ?? nextMintNumber;
      setSteps(createSteps(5));
      const ikaSigner = requireIkaMintSigner();
      let presignId = ikaSigner.presignId;
      let unverifiedPresignCapId = ikaSigner.unverifiedPresignCapId;

      if (!presignId || !unverifiedPresignCapId) {
        const presign = await buildIkaPresignTransaction({
          suiClient,
          dWalletId: ikaSigner.dWalletId,
        });
        const presignResult = await signAndExecuteTransaction({ transaction: presign.transaction });
        presignId = findCreatedObjectId(presignResult, "PresignSession") ?? "";
        unverifiedPresignCapId = findCreatedObjectId(presignResult, "UnverifiedPresignCap") ?? "";
      }

      if (!presignId || !unverifiedPresignCapId) {
        throw new Error("Ika presign was requested, but the PresignSession or UnverifiedPresignCap object ID was not visible in Sui object changes.");
      }

      const proofHash = keccak256(
        stringToBytes(
          JSON.stringify({
            suiReceiptId: mint.objectId,
            suiDigest: mint.digest,
            mintNumber,
            suiAddress: account.address,
            monadRecipient: targetMonadAddress,
          }),
        ),
      );
      setSteps(createSteps(6));
      const signRequest = await buildIkaMonadMintPassSignTransaction({
        suiClient,
        dWalletId: ikaSigner.dWalletId,
        dWalletCapId: ikaSigner.dWalletCapId,
        ikaDWalletAddress: ikaSigner.dWalletEvmAddress,
        monadRecipient: targetMonadAddress as `0x${string}`,
        suiReceiptId: mint.objectId,
        proofHash,
        presignId,
        unverifiedPresignCapId,
        userSecretKeyShare: dwallet?.userSecretKeyShare,
        userPublicOutput: dwallet?.userPublicOutput,
      });
      const signResult = await signAndExecuteTransaction({ transaction: signRequest.transaction });
      const signId = findCreatedObjectId(signResult, "SignSession");

      if (!signId) {
        throw new Error("Ika sign request was submitted, but the SignSession object ID was not visible in Sui object changes.");
      }

      setSteps(createSteps(7));
      const monadMint = await submitCompletedIkaMintPassSignature({
        suiClient,
        signId,
        monadTransaction: signRequest.monadTransaction,
      });
      const proof = {
        mode: "ika-mpc" as const,
        suiObjectId: mint.objectId,
        monadAddress: targetMonadAddress,
        message: "Ika MPC signed the Monad mintPass transaction.",
        signature: monadMint.signature,
        signer: "ika-dwallet" as const,
        proofHash,
        timestamp: Date.now(),
        claimDigest: monadMint.hash,
        monadMintTxHash: monadMint.hash,
        monadUnsignedTxHash: signRequest.unsignedTransactionHash,
        status: "claimed" as const,
      };

      const metadata = buildInkPassMetadata({
        mintNumber,
        suiObjectId: mint.objectId,
        monadAddressHash,
        proofUri: proof.proofHash,
      });
      const metadataUri = await uploadMetadata(metadata);

      setSteps(createSteps(8));
      const storedMint: StoredMint = {
        ...mint,
        mintNumber,
        name: metadata.name,
        metadataUri,
        proof,
      };
      saveStoredMint(storedMint);
      setLastMint(storedMint);
      setMintedCount((value) => value + 1);
      setSteps(createSteps(9));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Mint failed. Check wallet status and chain configuration.";
      const activeIndex = steps.findIndex((step) => step.state === "active");
      setError(message);
      setSteps(createSteps(Math.max(activeIndex, 0), Math.max(activeIndex, 0), message));
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel className="overflow-hidden p-0">
        <div className="border-b border-line bg-bg p-6">
          <img
            src={collectionConfig.imageGatewayUrl}
            alt="Ink Genesis Pass artwork"
            className="aspect-[1.35] w-full rounded-xl border border-primary/30 object-cover"
          />
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck size={14} />
              Ink + Ika
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
              <Fingerprint size={14} />
              Monad
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold text-ink">{collectionConfig.name}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{collectionConfig.description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Stat label="Mint Price" value={`${collectionConfig.mintPrice} SUI`} />
            <Stat label="NFT Chain" value="Monad" />
          </div>
          {collectionConfig.packageId && collectionConfig.collectionId && monadConfig.receiptContractAddress && (
            <div className="mt-3 grid gap-3">
              <ExplorerLink label="Sui package" value={collectionConfig.packageId} href={suiExplorerUrl(collectionConfig.packageId)} />
              <ExplorerLink label="Sui payment collection" value={collectionConfig.collectionId} href={suiExplorerUrl(collectionConfig.collectionId)} />
              <ExplorerLink label="Monad NFT contract" value={monadConfig.receiptContractAddress} href={monadExplorerUrl(monadConfig.receiptContractAddress)} />
            </div>
          )}
          <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="monad-address">
            Monad NFT wallet
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="monad-address"
              className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-primary"
              value={monadAddress}
              onChange={(event) => {
                setMonadAddress(event.target.value);
                setDWallet(undefined);
              }}
              placeholder="0x..."
              spellCheck={false}
            />
            <Button type="button" variant="secondary" className="shrink-0" onClick={createDWallet}>
              <KeyRound size={16} />
              Create Ika dWallet
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            This is the Monad address that receives the NFT when the Ika dWallet mint step is submitted.
          </p>
          {dwallet && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Ika DKG request submitted</p>
                  <p className="mt-1 break-words text-xs text-muted">{dwallet.dWalletCapId ?? dwallet.id}</p>
                </div>
                {dwallet.privateKey && (
                  <Button type="button" variant="secondary" onClick={copyPrivateKey}>
                    <Copy size={16} />
                    {privateKeyCopied ? "Copied" : "Copy key"}
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs leading-5 text-warning">
                Save the dWallet ID, cap ID, EVM address, and user share data from this Ika setup step. The mint button uses the configured Ika dWallet as the Monad minter.
              </p>
            </div>
          )}
          {!configured && (
            <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning">
              Configure the Sui package, Sui collection, Monad receipt contract, and Ika dWallet signer before enabling paid minting.
            </p>
          )}
          {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm leading-6 text-danger">{error}</p>}
          <Button className="mt-5 w-full" disabled={isMinting || !account?.address || !configured || !monadAddress} onClick={runMint}>
            <Coins size={16} />
            {isMinting ? "Coordinating mint" : "Pay on Sui, mint on Monad"}
          </Button>
        </div>
      </Panel>
      <div className="space-y-5">
        <TransactionTimeline steps={steps} />
        {lastMint?.proof && (
          <Panel>
            <h2 className="text-lg font-semibold text-ink">Monad NFT mint signed</h2>
            <p className="mt-3 text-sm leading-6 text-muted">dWallet signer: {lastMint.proof.signer}</p>
            <p className="mt-2 text-sm leading-6 text-muted">Monad mint tx: {lastMint.proof.monadMintTxHash ?? lastMint.proof.claimDigest}</p>
            <p className="mt-2 break-words text-sm leading-6 text-muted">{lastMint.proof.proofHash}</p>
          </Panel>
        )}
      </div>
      <MintSuccessModal mint={lastMint} onClose={() => setLastMint(undefined)} />
    </div>
  );
}
