import { Transaction } from "@mysten/sui/transactions";
import { bytesToHex, hexToBytes, keccak256, type Hex } from "viem";
import { ikaRuntimeConfig, requireIkaFeeObjects } from "@/config/ika";
import {
  buildSignedMonadMintPassRawTransaction,
  getUnsignedMonadTransactionBytes,
  getUnsignedMonadTransactionHash,
  prepareMonadMintPassTransaction,
  submitSignedMonadMintPassTransaction,
  type MonadMintPassTransaction,
} from "@/lib/monad/mintPassTx";

type IkaSdk = typeof import("@ika.xyz/sdk");

export type IkaDWalletDkgRequest = {
  transaction: Transaction;
  sessionIdentifier: Hex;
  userShareEncryptionKeys: Hex;
  userSecretKeyShare: Hex;
  userPublicOutput: Hex;
  networkEncryptionKeyId: string;
};

export type IkaMpcSignRequest = {
  transaction: Transaction;
  monadTransaction: MonadMintPassTransaction;
  unsignedTransactionBytes: Hex;
  unsignedTransactionHash: Hex;
};

export async function createIkaClient(suiClient: unknown) {
  const sdk = await loadIkaSdk();
  const ikaClient = new sdk.IkaClient({
    suiClient: suiClient as never,
    config: sdk.getNetworkConfig(ikaRuntimeConfig.network),
    cache: true,
    encryptionKeyOptions: { autoDetect: true },
  });

  await ikaClient.initialize();
  return ikaClient;
}

export async function buildIkaRegisterEncryptionKeyTransaction(input: {
  suiClient: unknown;
  rootSeed?: Hex;
}) {
  const sdk = await loadIkaSdk();
  const ikaClient = await createIkaClient(input.suiClient);
  const tx = new Transaction();
  const userShareEncryptionKeys = await createUserShareEncryptionKeys(sdk, input.rootSeed);
  const ikaTx = new sdk.IkaTransaction({
    ikaClient,
    transaction: tx as never,
    userShareEncryptionKeys,
  });

  await ikaTx.registerEncryptionKey({ curve: sdk.Curve.SECP256K1 });

  return {
    transaction: tx,
    userShareEncryptionKeys: bytesToHex(userShareEncryptionKeys.toShareEncryptionKeysBytes()),
  };
}

export async function buildIkaDWalletDkgTransaction(input: {
  suiClient: unknown;
  senderAddress: string;
  rootSeed?: Hex;
  sessionIdentifier?: Hex;
}): Promise<IkaDWalletDkgRequest> {
  const { ikaCoinObjectId, suiFeeMist } = requireIkaFeeObjects();
  const sdk = await loadIkaSdk();
  const ikaClient = await createIkaClient(input.suiClient);
  const tx = new Transaction();
  const userShareEncryptionKeys = await createUserShareEncryptionKeys(sdk, input.rootSeed);
  const ikaTx = new sdk.IkaTransaction({
    ikaClient,
    transaction: tx as never,
    userShareEncryptionKeys,
  });
  const sessionIdentifier = input.sessionIdentifier ?? randomHex32();
  const networkEncryptionKey = await ikaClient.getConfiguredNetworkEncryptionKey();
  const dkgRequestInput = await sdk.prepareDKGAsync(
    ikaClient,
    sdk.Curve.SECP256K1,
    userShareEncryptionKeys,
    hexToBytes(sessionIdentifier),
    input.senderAddress,
  );
  const suiCoin = tx.splitCoins(tx.gas, [tx.pure.u64(suiFeeMist)]);

  await ikaTx.requestDWalletDKG({
    dkgRequestInput,
    sessionIdentifier: ikaTx.registerSessionIdentifier(hexToBytes(sessionIdentifier)),
    dwalletNetworkEncryptionKeyId: networkEncryptionKey.id,
    curve: sdk.Curve.SECP256K1,
    ikaCoin: tx.object(ikaCoinObjectId),
    suiCoin,
  });

  return {
    transaction: tx,
    sessionIdentifier,
    networkEncryptionKeyId: networkEncryptionKey.id,
    userShareEncryptionKeys: bytesToHex(userShareEncryptionKeys.toShareEncryptionKeysBytes()),
    userSecretKeyShare: bytesToHex(dkgRequestInput.userSecretKeyShare),
    userPublicOutput: bytesToHex(dkgRequestInput.userPublicOutput),
  };
}

export async function buildIkaPresignTransaction(input: {
  suiClient: unknown;
  dWalletId: string;
  ikaClient?: Awaited<ReturnType<typeof createIkaClient>>;
}) {
  const { ikaCoinObjectId, suiFeeMist } = requireIkaFeeObjects();
  const sdk = await loadIkaSdk();
  const ikaClient = input.ikaClient ?? await createIkaClient(input.suiClient);
  const dWallet = await ikaClient.getDWallet(input.dWalletId);
  const tx = new Transaction();
  const ikaTx = new sdk.IkaTransaction({
    ikaClient,
    transaction: tx as never,
  });
  const suiCoin = tx.splitCoins(tx.gas, [tx.pure.u64(suiFeeMist)]);
  const unverifiedPresignCap = ikaTx.requestPresign({
    dWallet,
    signatureAlgorithm: sdk.SignatureAlgorithm.ECDSASecp256k1,
    ikaCoin: tx.object(ikaCoinObjectId),
    suiCoin,
  });

  return {
    transaction: tx,
    unverifiedPresignCap,
  };
}

export async function buildIkaMonadMintPassSignTransaction(input: {
  suiClient: unknown;
  dWalletId: string;
  dWalletCapId: string;
  ikaDWalletAddress: `0x${string}`;
  monadRecipient: `0x${string}`;
  suiReceiptId: string;
  proofHash: Hex;
  presignId: string;
  unverifiedPresignCapId: string;
  userSecretKeyShare?: Hex;
  userPublicOutput?: Hex;
  ikaClient?: Awaited<ReturnType<typeof createIkaClient>>;
}) {
  const { ikaCoinObjectId, suiFeeMist } = requireIkaFeeObjects();
  const sdk = await loadIkaSdk();
  const ikaClient = input.ikaClient ?? await createIkaClient(input.suiClient);
  const [dWallet, presign] = await Promise.all([
    ikaClient.getDWallet(input.dWalletId),
    ikaClient.getPresignInParticularState(input.presignId, "Completed", {
      timeout: ikaRuntimeConfig.signTimeoutMs,
    }),
  ]);
  const preparedMonad = await prepareMonadMintPassTransaction({
    ikaDWalletAddress: input.ikaDWalletAddress,
    monadRecipient: input.monadRecipient,
    suiReceiptId: input.suiReceiptId,
    proofHash: input.proofHash,
  });
  const tx = new Transaction();
  const ikaTx = new sdk.IkaTransaction({
    ikaClient,
    transaction: tx as never,
  });
  const message = preparedMonad.unsignedBytes;
  const isImportedKeyDWallet = dWallet.kind === "imported-key" || dWallet.kind === "imported-key-shared";
  const messageApproval = isImportedKeyDWallet
    ? ikaTx.approveImportedKeyMessage({
        dWalletCap: input.dWalletCapId,
        curve: sdk.Curve.SECP256K1,
        signatureAlgorithm: sdk.SignatureAlgorithm.ECDSASecp256k1,
        hashScheme: sdk.Hash.KECCAK256,
        message,
      })
    : ikaTx.approveMessage({
        dWalletCap: input.dWalletCapId,
        curve: sdk.Curve.SECP256K1,
        signatureAlgorithm: sdk.SignatureAlgorithm.ECDSASecp256k1,
        hashScheme: sdk.Hash.KECCAK256,
        message,
      });
  const verifiedPresignCap = ikaTx.verifyPresignCap({
    unverifiedPresignCap: input.unverifiedPresignCapId,
  });
  const suiCoin = tx.splitCoins(tx.gas, [tx.pure.u64(suiFeeMist)]);
  const signInput = {
    dWallet,
    hashScheme: sdk.Hash.KECCAK256,
    verifiedPresignCap,
    presign,
    secretShare: input.userSecretKeyShare ? hexToBytes(input.userSecretKeyShare) : undefined,
    publicOutput: input.userPublicOutput ? hexToBytes(input.userPublicOutput) : undefined,
    message,
    signatureScheme: sdk.SignatureAlgorithm.ECDSASecp256k1,
    ikaCoin: tx.object(ikaCoinObjectId),
    suiCoin,
  };

  if (isImportedKeyDWallet) {
    await ikaTx.requestSignWithImportedKey({
      ...signInput,
      dWallet: dWallet as Extract<typeof dWallet, { kind: "imported-key" | "imported-key-shared" }>,
      importedKeyMessageApproval: messageApproval,
    });
  } else {
    await ikaTx.requestSign({
      ...signInput,
      dWallet: dWallet as Extract<typeof dWallet, { kind: "zero-trust" | "shared" }>,
      messageApproval,
    });
  }

  return {
    transaction: tx,
    monadTransaction: preparedMonad.transaction,
    unsignedTransactionBytes: bytesToHex(message),
    unsignedTransactionHash: preparedMonad.unsignedHash,
  } satisfies IkaMpcSignRequest;
}

export async function submitCompletedIkaMintPassSignature(input: {
  suiClient: unknown;
  signId: string;
  monadTransaction: MonadMintPassTransaction;
  ikaClient?: Awaited<ReturnType<typeof createIkaClient>>;
}) {
  const sdk = await loadIkaSdk();
  const ikaClient = input.ikaClient ?? await createIkaClient(input.suiClient);
  const sign = await ikaClient.getSignInParticularState(
    input.signId,
    sdk.Curve.SECP256K1,
    sdk.SignatureAlgorithm.ECDSASecp256k1,
    "Completed",
    { timeout: ikaRuntimeConfig.signTimeoutMs },
  );
  const signature = new Uint8Array(sign.state.Completed.signature);
  const rawTransaction = await buildSignedMonadMintPassRawTransaction({
    transaction: input.monadTransaction,
    ikaSignature: signature,
  });
  const hash = await submitSignedMonadMintPassTransaction({ rawTransaction });

  return {
    hash,
    rawTransaction,
    signature: bytesToHex(signature),
  };
}

export function getIkaMonadMintPassMessage(transaction: MonadMintPassTransaction) {
  return {
    bytes: bytesToHex(getUnsignedMonadTransactionBytes(transaction)),
    hash: getUnsignedMonadTransactionHash(transaction),
  };
}

async function loadIkaSdk(): Promise<IkaSdk> {
  return import("@ika.xyz/sdk");
}

async function createUserShareEncryptionKeys(sdk: IkaSdk, rootSeed?: Hex) {
  const seed = rootSeed ? hexToBytes(rootSeed) : crypto.getRandomValues(new Uint8Array(32));
  return sdk.UserShareEncryptionKeys.fromRootSeedKey(seed, sdk.Curve.SECP256K1);
}

function randomHex32() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return keccak256(bytes);
}
