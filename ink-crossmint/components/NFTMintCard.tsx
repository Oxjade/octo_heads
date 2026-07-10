"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { isAddress, keccak256, stringToBytes } from "viem";
import { BadgeCheck, Coins, ExternalLink, Fingerprint, Send, UserRound } from "lucide-react";
import { collectionConfig } from "@/config/collection";
import { monadConfig } from "@/config/chains";
import { ikaRuntimeConfig, requireIkaMintSigner } from "@/config/ika";
import { createInkAdapter } from "@/lib/ink/InkAdapter";
import type { StoredMint } from "@/lib/storage/localStore";
import { loadInkUsername, loadTelegramJoined, saveInkUsername, saveStoredMint, saveTelegramJoined } from "@/lib/storage/localStore";
import { buildInkPassMetadata } from "@/lib/metadata/buildMetadata";
import { uploadMetadata } from "@/lib/metadata/uploadMetadata";
import { buildIkaMonadMintPassSignTransaction, buildIkaPresignTransaction, createIkaClient, submitCompletedIkaMintPassSignature } from "@/lib/ika/mpc";
import { getMonadAddressHash } from "@/lib/monad/proof";
import { Button, Panel, Stat, buttonClassName } from "./ui";
import { MintSuccessModal } from "./MintSuccessModal";

const INK_WAITLIST_URL = "https://www.useink.xyz/purchase";
const INK_TELEGRAM_URL = "https://t.me/+xKopIb4T7To3NTM8";

function findCreatedObjectId(
  result: { objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }> },
  typeName: string,
) {
  return result.objectChanges?.find((change) => {
    if (change.type !== "created" || !change.objectType) return false;
    return change.objectType.endsWith(`::${typeName}`) || change.objectType.includes(`::${typeName}<`);
  })?.objectId;
}

async function requireAddressOwnedObject(input: {
  suiClient: ReturnType<typeof useSuiClient>;
  objectId: string;
  ownerAddress: string;
  label: string;
}) {
  const object = await input.suiClient.getObject({
    id: input.objectId,
    options: { showOwner: true },
  });
  const owner = object.data?.owner;
  const addressOwner = typeof owner === "object" && owner && "AddressOwner" in owner ? owner.AddressOwner : undefined;

  if (!addressOwner || normalizeSuiAddress(addressOwner) !== normalizeSuiAddress(input.ownerAddress)) {
    throw new Error(
      `${input.label} is owned by ${addressOwner ?? "another account"}, so the connected wallet cannot create the Ika presign/sign transaction. Public minting needs a server-side coordinator or sponsored Ika transaction flow.`,
    );
  }
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
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<string | undefined>();
  const [mintedCount, setMintedCount] = useState(0);
  const [inkUsername, setInkUsername] = useState("");
  const [savedInkUsername, setSavedInkUsername] = useState("");
  const [telegramJoined, setTelegramJoined] = useState(false);
  const [monadAddress, setMonadAddress] = useState("");
  const [lastMint, setLastMint] = useState<StoredMint | undefined>();
  const [error, setError] = useState<string | undefined>();

  const nextMintNumber = useMemo(() => mintedCount + 1, [mintedCount]);
  const inkHandle = useMemo(() => {
    const normalized = inkUsername.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) return "";
    return normalized.endsWith(".ink") ? normalized : `${normalized}.ink`;
  }, [inkUsername]);
  const inkHandleIsValid = !inkHandle || /^[a-z0-9][a-z0-9-]{1,28}\.ink$/.test(inkHandle);
  const inkHandleCanBeSaved = Boolean(inkHandle && inkHandleIsValid);
  const inkHandleIsSaved = Boolean(inkHandle && inkHandle === savedInkUsername);
  const ikaMintReady = Boolean(
    ikaRuntimeConfig.ikaCoinObjectId &&
      ikaRuntimeConfig.dWalletId &&
      ikaRuntimeConfig.dWalletCapId &&
      ikaRuntimeConfig.dWalletEvmAddress,
  );
  const configured = Boolean(collectionConfig.packageId && collectionConfig.collectionId && monadConfig.receiptContractAddress && ikaMintReady);

  useEffect(() => {
    const stored = loadInkUsername();
    if (!stored) return;
    setInkUsername(stored);
    setSavedInkUsername(stored);
  }, []);

  useEffect(() => {
    setTelegramJoined(loadTelegramJoined());
  }, []);

  function setInkAppUsername() {
    if (!inkHandleCanBeSaved) return;
    saveInkUsername(inkHandle);
    setSavedInkUsername(inkHandle);
  }

  function joinTelegram() {
    saveTelegramJoined(true);
    setTelegramJoined(true);
    window.open(INK_TELEGRAM_URL, "_blank", "noopener,noreferrer");
  }

  async function runMint() {
    setError(undefined);
    setMintStatus(undefined);

    if (!account?.address) {
      setError("Connect a Sui wallet before minting.");
      return;
    }

    if (!isAddress(monadAddress)) {
      setError("Enter a valid Monad wallet address.");
      return;
    }

    if (!telegramJoined) {
      setError("Join the Ink Telegram before minting.");
      return;
    }

    setIsMinting(true);

    try {
      const adapter = createInkAdapter({
        suiAddress: account.address,
        monadAddress,
        signSuiTransaction: async (transaction) => {
          const result = await signAndExecuteTransaction({
            transaction,
          });
          return result;
        },
      });

      const user = await adapter.connect();

      const targetMonadAddress = user.monadAddress ?? monadAddress;
      const monadAddressHash = getMonadAddressHash(targetMonadAddress);
      const pendingProofUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://useink.xyz"}/proofs/pending/${Date.now()}`;

      // Step 1 — Sui payment
      setMintStatus("Step 1 / 5 — Approve the Sui payment in your wallet…");
      const mint = await adapter.acceptSuiPayment({
        packageId: collectionConfig.packageId,
        collectionId: collectionConfig.collectionId,
        monadAddressHash,
        proofUri: pendingProofUri,
      });

      const mintNumber = mint.mintNumber ?? nextMintNumber;
      const ikaSigner = requireIkaMintSigner();

      await Promise.all([
        requireAddressOwnedObject({
          suiClient,
          objectId: ikaRuntimeConfig.ikaCoinObjectId,
          ownerAddress: account.address,
          label: "Ika fee coin",
        }),
        requireAddressOwnedObject({
          suiClient,
          objectId: ikaSigner.dWalletCapId,
          ownerAddress: account.address,
          label: "Ika dWallet cap",
        }),
      ]);

      // Initialise the Ika client once and reuse it — initialize() makes a
      // network round-trip to Ika infrastructure, so we do it a single time.
      setMintStatus("Step 2 / 5 — Connecting to Ika network…");
      const ikaClient = await createIkaClient(suiClient);

      // Step 2 — Presign (single-use Sui object, always created fresh per mint)
      setMintStatus("Step 2 / 5 — Approve the Ika presign transaction in your wallet…");
      const presign = await buildIkaPresignTransaction({
        suiClient,
        dWalletId: ikaSigner.dWalletId,
        ikaClient,
      });
      const presignResult = await signAndExecuteTransaction({ transaction: presign.transaction });
      const presignId = findCreatedObjectId(presignResult, "PresignSession") ?? "";
      const unverifiedPresignCapId = findCreatedObjectId(presignResult, "UnverifiedPresignCap") ?? "";

      if (!presignId || !unverifiedPresignCapId) {
        throw new Error("Ika presign was requested, but the PresignSession or UnverifiedPresignCap object ID was not visible in Sui object changes.");
      }

      // Step 3 — Ika network processes the presign (up to ~90 s)
      setMintStatus("Step 3 / 5 — Ika network is processing the presign session… (up to ~90 s)");
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
        ikaClient,
      });

      // Step 4 — Sign transaction (wallet approval + Ika network sign, up to ~90 s)
      setMintStatus("Step 4 / 5 — Approve the Ika sign transaction in your wallet…");
      const signResult = await signAndExecuteTransaction({ transaction: signRequest.transaction });
      const signId = findCreatedObjectId(signResult, "SignSession");

      if (!signId) {
        throw new Error("Ika sign request was submitted, but the SignSession object ID was not visible in Sui object changes.");
      }

      setMintStatus("Step 4 / 5 — Ika network is completing the signing… (up to ~90 s)");
      const monadMint = await submitCompletedIkaMintPassSignature({
        suiClient,
        signId,
        ikaClient,
        monadTransaction: signRequest.monadTransaction,
      });

      // Step 5 — Broadcast to Monad + upload metadata
      setMintStatus("Step 5 / 5 — Broadcasting to Monad and saving metadata…");
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
      setMintStatus(undefined);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Mint failed. Check wallet status and chain configuration.";
      setError(message);
      setMintStatus(undefined);
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <div className={lastMint?.proof ? "grid gap-5 lg:grid-cols-[0.95fr_1.05fr]" : "mx-auto grid max-w-2xl gap-5"}>
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
          <div className="mt-5 rounded-lg border border-line bg-bg/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-sm font-semibold text-ink" htmlFor="ink-username">
                  Ink app username
                </label>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Set the handle you want to use when the Ink app opens.
                </p>
              </div>
              {savedInkUsername && (
                <span className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                  <UserRound size={13} />
                  {savedInkUsername}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="ink-username"
                className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                value={inkUsername}
                onChange={(event) => {
                  setInkUsername(event.target.value);
                }}
                placeholder="nova.ink"
                spellCheck={false}
                autoCapitalize="none"
              />
              <Button
                type="button"
                variant={inkHandleIsSaved ? "secondary" : "primary"}
                className="shrink-0"
                disabled={!inkHandleCanBeSaved || inkHandleIsSaved}
                onClick={setInkAppUsername}
              >
                <UserRound size={16} />
                {inkHandleIsSaved ? "Username set" : "Set username"}
              </Button>
            </div>
            {!inkHandleIsValid && (
              <p className="mt-2 text-xs leading-5 text-warning">
                Use 2-29 lowercase letters, numbers, or hyphens before .ink.
              </p>
            )}
            {inkHandleIsSaved && (
              <p className="mt-2 text-xs leading-5 text-success">
                Saved for this demo. Join the waitlist to continue into Ink early access.
              </p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a className={buttonClassName({ variant: "secondary" })} href={INK_WAITLIST_URL} target="_blank" rel="noreferrer">
                Join waitlist
                <ExternalLink size={15} />
              </a>
              <Button type="button" variant={telegramJoined ? "secondary" : "ghost"} className="border border-line" onClick={joinTelegram}>
                <Send size={15} />
                {telegramJoined ? "Telegram joined" : "Join Telegram"}
              </Button>
            </div>
            {!telegramJoined && (
              <p className="mt-2 text-xs leading-5 text-warning">
                Telegram is required before minting.
              </p>
            )}
          </div>
          <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="monad-address">
            Monad NFT wallet
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="monad-address"
              className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-primary"
              value={monadAddress}
              onChange={(event) => setMonadAddress(event.target.value)}
              placeholder="0x..."
              spellCheck={false}
            />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            This is the Monad address that receives the NFT. Minting is signed by the configured production Ika dWallet.
          </p>
          {!configured && (
            <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning">
              Configure the Sui package, Sui collection, Monad receipt contract, and Ika dWallet signer before enabling paid minting.
            </p>
          )}
          {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm leading-6 text-danger">{error}</p>}
          {mintStatus && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm leading-6 text-primary">{mintStatus}</p>
            </div>
          )}
          <Button className="mt-5 w-full" disabled={isMinting || !account?.address || !configured || !monadAddress || !telegramJoined} onClick={runMint}>
            <Coins size={16} />
            {isMinting ? "Coordinating mint…" : telegramJoined ? "Pay on Sui, mint on Monad" : "Join Telegram to mint"}
          </Button>
        </div>
      </Panel>
      {lastMint?.proof && (
        <div className="space-y-5">
          <Panel>
            <h2 className="text-lg font-semibold text-ink">Monad NFT mint signed</h2>
            <p className="mt-3 text-sm leading-6 text-muted">dWallet signer: {lastMint.proof.signer}</p>
            <p className="mt-2 text-sm leading-6 text-muted">Monad mint tx: {lastMint.proof.monadMintTxHash ?? lastMint.proof.claimDigest}</p>
            <p className="mt-2 break-words text-sm leading-6 text-muted">{lastMint.proof.proofHash}</p>
          </Panel>
        </div>
      )}
      <MintSuccessModal mint={lastMint} onClose={() => setLastMint(undefined)} />
    </div>
  );
}
