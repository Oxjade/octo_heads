import { NextResponse } from "next/server";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { bytesToHex, isAddress, keccak256, stringToBytes, type Hex } from "viem";
import { collectionConfig } from "@/config/collection";
import { suiNetwork, suiRpcUrl } from "@/config/chains";
import { requireIkaMintSigner } from "@/config/ika";
import {
  buildIkaMonadMintPassSignTransaction,
  buildIkaPresignTransaction,
  createIkaClient,
  submitCompletedIkaMintPassSignature,
} from "@/lib/ika/mpc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type CoordinatorMintRequest = {
  suiDigest?: string;
  suiReceiptId?: string;
  mintNumber?: number;
  suiAddress?: string;
  monadRecipient?: string;
  monadAddressHash?: string;
};

function findCreatedObjectId(
  result: { objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }> | null },
  typeName: string,
) {
  return result.objectChanges?.find((change) => {
    if (change.type !== "created" || !change.objectType) return false;
    return change.objectType.endsWith(`::${typeName}`) || change.objectType.includes(`::${typeName}<`);
  })?.objectId;
}

function getCoordinatorKeypair() {
  const privateKey = process.env.IKA_SUI_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Configure IKA_SUI_PRIVATE_KEY for the server-side Ika coordinator.");
  }

  const decoded = decodeSuiPrivateKey(privateKey);

  if (decoded.scheme !== "ED25519") {
    throw new Error(`IKA_SUI_PRIVATE_KEY must be an ED25519 Sui private key, got ${decoded.scheme}.`);
  }

  return Ed25519Keypair.fromSecretKey(decoded.secretKey);
}

function getSuiClient() {
  return new SuiJsonRpcClient({
    url: process.env.IKA_SUI_RPC ?? process.env.SUI_RPC_URL ?? process.env.NEXT_PUBLIC_SUI_RPC_URL ?? suiRpcUrl,
    network: (process.env.IKA_NETWORK ?? process.env.NEXT_PUBLIC_IKA_NETWORK ?? suiNetwork) as typeof suiNetwork,
  });
}

function parsePaymentEventJson(value: unknown) {
  if (!value || typeof value !== "object") return undefined;

  const event = value as {
    payer?: unknown;
    mint_number?: unknown;
    monad_address_hash?: unknown;
  };

  return {
    payer: typeof event.payer === "string" ? event.payer : undefined,
    mintNumber: Number(event.mint_number),
    monadAddressHash: normalizeMoveBytes(event.monad_address_hash),
  };
}

function normalizeMoveBytes(value: unknown) {
  if (Array.isArray(value)) {
    return bytesToHex(Uint8Array.from(value.map((byte) => Number(byte))));
  }

  if (typeof value === "string") {
    return value.startsWith("0x") ? value.toLowerCase() : bytesToHex(Uint8Array.from(value.split("").map((char) => char.charCodeAt(0))));
  }

  return undefined;
}

async function verifySuiPayment(input: {
  suiClient: SuiJsonRpcClient;
  suiDigest: string;
  suiAddress: string;
  mintNumber: number;
  monadAddressHash: string;
}) {
  const transaction = await input.suiClient.getTransactionBlock({
    digest: input.suiDigest,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  if (transaction.effects?.status.status !== "success") {
    throw new Error("Sui payment transaction did not execute successfully.");
  }

  const event = transaction.events?.find((candidate) => {
    return candidate.type === `${collectionConfig.packageId}::ink_genesis_pass::PaymentAccepted`;
  });

  const payment = parsePaymentEventJson(event?.parsedJson);

  if (!payment) {
    throw new Error("Sui payment transaction does not contain the expected PaymentAccepted event.");
  }

  if (payment.payer?.toLowerCase() !== input.suiAddress.toLowerCase()) {
    throw new Error("Sui payment payer does not match the connected wallet.");
  }

  if (payment.mintNumber !== input.mintNumber) {
    throw new Error("Sui payment mint number does not match the coordinator request.");
  }

  if (payment.monadAddressHash !== input.monadAddressHash.toLowerCase()) {
    throw new Error("Sui payment Monad recipient hash does not match the coordinator request.");
  }
}

function validateRequest(body: CoordinatorMintRequest) {
  if (!body.suiDigest || !body.suiReceiptId || !body.suiAddress || !body.monadRecipient || !body.monadAddressHash) {
    throw new Error("Missing coordinator mint request fields.");
  }

  if (body.suiReceiptId !== body.suiDigest) {
    throw new Error("Sui receipt ID must match the verified Sui payment digest.");
  }

  const mintNumber = Number(body.mintNumber);

  if (!Number.isInteger(mintNumber) || mintNumber <= 0) {
    throw new Error("Invalid mint number.");
  }

  if (!isAddress(body.monadRecipient)) {
    throw new Error("Invalid Monad recipient address.");
  }

  return {
    suiDigest: body.suiDigest,
    suiReceiptId: body.suiReceiptId,
    suiAddress: body.suiAddress,
    monadRecipient: body.monadRecipient as `0x${string}`,
    monadAddressHash: body.monadAddressHash.toLowerCase() as Hex,
    mintNumber,
  };
}

export async function POST(request: Request) {
  try {
    const input = validateRequest((await request.json()) as CoordinatorMintRequest);
    const suiClient = getSuiClient();
    const coordinatorKeypair = getCoordinatorKeypair();
    const coordinatorAddress = coordinatorKeypair.getPublicKey().toSuiAddress();
    const ikaSigner = requireIkaMintSigner();

    await verifySuiPayment({
      suiClient,
      suiDigest: input.suiDigest,
      suiAddress: input.suiAddress,
      mintNumber: input.mintNumber,
      monadAddressHash: input.monadAddressHash,
    });

    const ikaClient = await createIkaClient(suiClient);
    const presign = await buildIkaPresignTransaction({
      suiClient,
      dWalletId: ikaSigner.dWalletId,
      ikaClient,
    });
    presign.transaction.setSender(coordinatorAddress);
    const unverifiedPresignCap = presign.unverifiedPresignCap as unknown as { 0: typeof presign.unverifiedPresignCap };
    presign.transaction.transferObjects([unverifiedPresignCap[0]], coordinatorAddress);

    const presignResult = await suiClient.signAndExecuteTransaction({
      signer: coordinatorKeypair,
      transaction: presign.transaction,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });
    const presignId = findCreatedObjectId(presignResult, "PresignSession") ?? "";
    const unverifiedPresignCapId = findCreatedObjectId(presignResult, "UnverifiedPresignCap") ?? "";

    if (!presignId || !unverifiedPresignCapId) {
      throw new Error("Coordinator created an Ika presign, but the presign object IDs were not visible.");
    }

    const proofHash = keccak256(
      stringToBytes(
        JSON.stringify({
          suiReceiptId: input.suiReceiptId,
          suiDigest: input.suiDigest,
          mintNumber: input.mintNumber,
          suiAddress: input.suiAddress,
          monadRecipient: input.monadRecipient,
        }),
      ),
    );

    const signRequest = await buildIkaMonadMintPassSignTransaction({
      suiClient,
      dWalletId: ikaSigner.dWalletId,
      dWalletCapId: ikaSigner.dWalletCapId,
      ikaDWalletAddress: ikaSigner.dWalletEvmAddress,
      monadRecipient: input.monadRecipient,
      suiReceiptId: input.suiReceiptId,
      proofHash,
      presignId,
      unverifiedPresignCapId,
      ikaClient,
    });
    signRequest.transaction.setSender(coordinatorAddress);

    const signResult = await suiClient.signAndExecuteTransaction({
      signer: coordinatorKeypair,
      transaction: signRequest.transaction,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });
    const signId = findCreatedObjectId(signResult, "SignSession");

    if (!signId) {
      throw new Error("Coordinator submitted an Ika sign request, but the SignSession object ID was not visible.");
    }

    const monadMint = await submitCompletedIkaMintPassSignature({
      suiClient,
      signId,
      ikaClient,
      monadTransaction: signRequest.monadTransaction,
    });

    return NextResponse.json({
      proofHash,
      signature: monadMint.signature,
      monadMintTxHash: monadMint.hash,
      monadUnsignedTxHash: signRequest.unsignedTransactionHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coordinator mint failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
