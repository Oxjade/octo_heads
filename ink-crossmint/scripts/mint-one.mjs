#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as dns from "dns";
import { fileURLToPath, pathToFileURL } from "url";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { createInkClient, IkaEvmSigningConnector } from "@ink-sdk/sdk";
import { createEthersEvmAdapter } from "@ink-sdk/evm";
import {
  Curve,
  getNetworkConfig,
  IkaClient,
  IkaTransaction,
  SignatureAlgorithm,
  UserShareEncryptionKeys,
} from "@ika.xyz/sdk";
import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  stringToBytes,
} from "viem";

dns.setDefaultResultOrder?.("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const SUI_CLOCK_OBJECT_ID = "0x6";
const DEFAULT_SUI_RPC = "https://sui-testnet-rpc.publicnode.com";

const receiptAbi = [
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
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
];

function parseEnvFile(filePath) {
  const env = {};
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return { ...env, ...process.env };
}

function writeEnvUpdates(filePath, updates) {
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").split(/\r?\n/) : [];
  const seen = new Set();
  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return line;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key] ?? ""}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) nextLines.push(`${key}=${value ?? ""}`);
  }

  fs.writeFileSync(filePath, nextLines.join("\n").replace(/\n*$/, "\n"));
}

function requireEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function getKeypair(suiPrivateKey) {
  const decoded = decodeSuiPrivateKey(suiPrivateKey);
  if (decoded.schema !== "ED25519") {
    throw new Error(`Expected an ED25519 Sui private key, got ${decoded.schema}`);
  }
  return Ed25519Keypair.fromSecretKey(decoded.secretKey);
}

function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [];
}

function findCreatedObjectId(result, typeName) {
  return result.objectChanges?.find((change) => {
    if (change.type !== "created" || !change.objectType) return false;
    return change.objectType.endsWith(`::${typeName}`) || change.objectType.includes(`::${typeName}<`);
  })?.objectId;
}

function findCreatedObjectIdMatching(result, pattern) {
  return result.objectChanges?.find((change) => {
    return change.type === "created" && typeof change.objectType === "string" && pattern.test(change.objectType);
  })?.objectId;
}

function objectId(value) {
  return value?.id?.id || value?.id || value?.objectId || value;
}

function getMonadAddressHash(monadAddress) {
  return `0x${Buffer.from(monadAddress.toLowerCase(), "utf8").toString("hex")}`;
}

function buildSuiPaymentTransaction(env, monadAddressHash) {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(env.NEXT_PUBLIC_MINT_PRICE_MIST ?? "1500000000"))]);
  const proofUri = `${env.NEXT_PUBLIC_APP_URL ?? "https://useink.xyz"}/proofs/pending/${Date.now()}`;

  tx.moveCall({
    target: `${normalizeSuiAddress(env.NEXT_PUBLIC_SUI_PACKAGE_ID)}::ink_genesis_pass::mint`,
    arguments: [
      tx.object(env.NEXT_PUBLIC_SUI_COLLECTION_ID),
      tx.object(SUI_CLOCK_OBJECT_ID),
      payment,
      tx.pure.vector("u8", hexToBytes(monadAddressHash)),
      tx.pure.string(proofUri),
    ],
  });

  return { tx, proofUri };
}

function decodeDataUriJson(uri) {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) return undefined;
  return JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf-8"));
}

async function createFreshPresign(env, keypair) {
  const nestedSuiDist = path.join(root, "node_modules/@ika.xyz/sdk/node_modules/@mysten/sui/dist");
  const [
    { SuiJsonRpcClient },
    { Transaction: IkaSuiTransaction },
    nestedCryptography,
    nestedEd25519,
  ] = await Promise.all([
    import(pathToFileURL(path.join(nestedSuiDist, "jsonRpc/index.mjs")).href),
    import(pathToFileURL(path.join(nestedSuiDist, "transactions/index.mjs")).href),
    import(pathToFileURL(path.join(nestedSuiDist, "cryptography/index.mjs")).href),
    import(pathToFileURL(path.join(nestedSuiDist, "keypairs/ed25519/index.mjs")).href),
  ]);
  const decoded = nestedCryptography.decodeSuiPrivateKey(env.IKA_SUI_PRIVATE_KEY);
  const nestedKeypair = nestedEd25519.Ed25519Keypair.fromSecretKey(decoded.secretKey);
  const network = env.IKA_NETWORK ?? env.NEXT_PUBLIC_IKA_NETWORK ?? "testnet";
  const rpcUrls = [
    env.IKA_SUI_RPC,
    DEFAULT_SUI_RPC,
    "https://fullnode.testnet.sui.io:443",
  ].filter((value, index, list) => value && list.indexOf(value) === index);
  let suiClient;
  let ikaClient;
  let lastError;

  for (const rpcUrl of rpcUrls) {
    try {
      suiClient = new SuiJsonRpcClient({ url: rpcUrl, network });
      ikaClient = new IkaClient({
        suiClient,
        config: getNetworkConfig(network),
        encryptionKeyOptions: env.IKA_NETWORK_ENCRYPTION_KEY_ID
          ? { encryptionKeyID: env.IKA_NETWORK_ENCRYPTION_KEY_ID }
          : { autoDetect: true },
      });
      await ikaClient.initialize();
      break;
    } catch (error) {
      lastError = error;
      suiClient = undefined;
      ikaClient = undefined;
    }
  }

  if (!suiClient || !ikaClient) {
    throw lastError ?? new Error("Unable to initialize Ika client for presign creation.");
  }

  const userShareEncryptionKeys = UserShareEncryptionKeys.fromShareEncryptionKeysBytes(
    Buffer.from(env.IKA_USER_SHARE_ENCRYPTION_KEYS_B64, "base64"),
  );
  const activeNetworkEncryptionKey = await ikaClient.getLatestNetworkEncryptionKey(Curve.SECP256K1);
  const tx = new IkaSuiTransaction();
  const ikaTx = new IkaTransaction({
    ikaClient,
    transaction: tx,
    userShareEncryptionKeys,
  });
  const unverifiedPresignCap = ikaTx.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: objectId(activeNetworkEncryptionKey),
    curve: Curve.SECP256K1,
    signatureAlgorithm: SignatureAlgorithm.ECDSASecp256k1,
    ikaCoin: tx.object(env.IKA_COIN_ID),
    suiCoin: tx.object(env.IKA_SUI_COIN_ID),
  });

  tx.transferObjects([unverifiedPresignCap], nestedKeypair.getPublicKey().toSuiAddress());

  const result = await suiClient.signAndExecuteTransaction({
    signer: nestedKeypair,
    transaction: tx,
    options: {
      showEvents: true,
      showObjectChanges: true,
      showEffects: true,
    },
  });
  const presignId =
    findCreatedObjectIdMatching(result, /PresignSession/) ?? findCreatedObjectIdMatching(result, /Presign/);
  const unverifiedPresignCapId =
    findCreatedObjectIdMatching(result, /UnverifiedPresignCap/) ?? objectId(unverifiedPresignCap);

  if (!presignId || !unverifiedPresignCapId) {
    throw new Error("Fresh Ika presign was submitted, but the presign IDs were not visible in object changes.");
  }

  await ikaClient.getPresignInParticularState(presignId, "Completed", {
    timeout: Number(env.NEXT_PUBLIC_IKA_SIGN_TIMEOUT_MS ?? env.IKA_SIGN_TIMEOUT_MS ?? 120000),
    interval: 1500,
  });

  writeEnvUpdates(envPath, {
    IKA_PRESIGN_ID: presignId,
    IKA_UNVERIFIED_PRESIGN_CAP_ID: unverifiedPresignCapId,
    NEXT_PUBLIC_IKA_PRESIGN_ID: presignId,
    NEXT_PUBLIC_IKA_UNVERIFIED_PRESIGN_CAP_ID: unverifiedPresignCapId,
  });

  return { presignId, unverifiedPresignCapId };
}

async function callMonadMint(env, monadChain, monadRecipient, suiReceiptId, proofHash) {
  const inkEnv = {
    ...env,
    IKA_NETWORK: env.IKA_NETWORK ?? env.NEXT_PUBLIC_IKA_NETWORK ?? "testnet",
    IKA_SUI_RPC: env.IKA_SUI_RPC || DEFAULT_SUI_RPC,
    IKA_EVM_CHAIN_ID: env.NEXT_PUBLIC_MONAD_CHAIN_ID,
    IKA_EVM_RPC: env.NEXT_PUBLIC_MONAD_RPC_URL,
  };
  const ink = createInkClient({
    mode: "production",
    ika: {
      connector: new IkaEvmSigningConnector({ env: inkEnv }),
      network: inkEnv.IKA_NETWORK,
    },
    chains: [monadChain],
    adapters: [
      createEthersEvmAdapter({
        chain: monadChain,
        rpcUrl: env.NEXT_PUBLIC_MONAD_RPC_URL,
        signerAddress: monadRecipient,
        broadcast: true,
        confirmations: 1,
        timeoutMs: 120_000,
      }),
    ],
  });

  return ink.call({
    targetChain: monadChain,
    target: {
      contract: env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT,
      abi: receiptAbi,
      functionName: "mintPass",
      args: [monadRecipient, suiReceiptId, proofHash],
    },
    signing: {
      provider: "ika",
      dWalletId: env.IKA_DWALLET_ID,
    },
    execution: {
      waitForReceipt: true,
      returnExplorerUrl: true,
      idempotencyKey: `mint-${suiReceiptId}`,
    },
  });
}

async function main() {
  let env = parseEnvFile(envPath);

  requireEnv(env, [
    "IKA_SUI_PRIVATE_KEY",
    "IKA_COIN_ID",
    "IKA_SUI_COIN_ID",
    "IKA_USER_SHARE_ENCRYPTION_KEYS_B64",
    "IKA_DWALLET_ID",
    "IKA_ETH_ADDRESS",
    "NEXT_PUBLIC_SUI_PACKAGE_ID",
    "NEXT_PUBLIC_SUI_COLLECTION_ID",
    "NEXT_PUBLIC_MONAD_RPC_URL",
    "NEXT_PUBLIC_MONAD_CHAIN_ID",
    "NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT",
  ]);

  const keypair = getKeypair(env.IKA_SUI_PRIVATE_KEY);
  const suiAddress = keypair.getPublicKey().toSuiAddress();
  const monadRecipient = getAddress(env.IKA_ETH_ADDRESS);
  const monadAddressHash = getMonadAddressHash(monadRecipient);
  const suiClient = new SuiClient({ url: env.IKA_SUI_RPC || DEFAULT_SUI_RPC });

  console.log(`Sui payer: ${suiAddress}`);
  console.log(`Monad recipient: ${monadRecipient}`);
  console.log(`Monad contract: ${env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT}`);

  let suiReceiptId = process.env.SUI_RECEIPT_ID;
  let proofHash = process.env.PROOF_HASH;

  if (!suiReceiptId || !proofHash) {
    const { tx: suiPaymentTx } = buildSuiPaymentTransaction(env, monadAddressHash);
    const suiResult = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: suiPaymentTx,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
      },
    });
    suiReceiptId = suiResult.digest;

    const mintNumber = Number(
      suiResult.events?.find((event) => event.type.endsWith("::PaymentAccepted"))?.parsedJson?.mint_number ?? 0,
    );
    proofHash = keccak256(
      stringToBytes(
        JSON.stringify({
          suiReceiptId,
          suiDigest: suiResult.digest,
          mintNumber,
          suiAddress,
          monadRecipient,
        }),
      ),
    );

    console.log(`Sui tx: ${suiResult.digest}`);
    console.log(`Sui receipt: ${suiReceiptId}`);
    console.log(`Proof hash: ${proofHash}`);
  } else {
    console.log(`Reusing Sui receipt: ${suiReceiptId}`);
    console.log(`Reusing proof hash: ${proofHash}`);
  }

  const monadChain = {
    type: "evm",
    chainId: Number(env.NEXT_PUBLIC_MONAD_CHAIN_ID),
    rpcUrl: env.NEXT_PUBLIC_MONAD_RPC_URL,
    explorerUrl: "https://testnet.monadscan.com",
  };
  if (process.env.FORCE_FRESH_PRESIGN === "1") {
    console.log("Creating a fresh Ika presign before Monad mint...");
    const fresh = await createFreshPresign(env, keypair);
    console.log(`Fresh presign: ${fresh.presignId}`);
    env = {
      ...parseEnvFile(envPath),
      IKA_PRESIGN_ID: fresh.presignId,
      IKA_UNVERIFIED_PRESIGN_CAP_ID: fresh.unverifiedPresignCapId,
    };
  }

  let receipt;
  try {
    receipt = await callMonadMint(env, monadChain, monadRecipient, suiReceiptId, proofHash);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/presign|has been deleted/i.test(message)) throw error;

    console.log("Saved Ika presign is spent; creating a fresh presign and retrying Monad mint...");
    const fresh = await createFreshPresign(env, keypair);
    console.log(`Fresh presign: ${fresh.presignId}`);
    env = {
      ...parseEnvFile(envPath),
      IKA_PRESIGN_ID: fresh.presignId,
      IKA_UNVERIFIED_PRESIGN_CAP_ID: fresh.unverifiedPresignCapId,
    };
    receipt = await callMonadMint(env, monadChain, monadRecipient, suiReceiptId, proofHash);
  }

  const monadTx = receipt.transaction?.hash;
  if (!monadTx) {
    throw new Error("Monad mint completed without a transaction hash.");
  }

  const publicClient = createPublicClient({
    chain: {
      id: Number(env.NEXT_PUBLIC_MONAD_CHAIN_ID),
      name: "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [env.NEXT_PUBLIC_MONAD_RPC_URL] } },
    },
    transport: http(env.NEXT_PUBLIC_MONAD_RPC_URL),
  });

  const tokenUri = await publicClient.readContract({
    address: env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT,
    abi: receiptAbi,
    functionName: "tokenURI",
    args: [1n],
  });
  const owner = await publicClient.readContract({
    address: env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT,
    abi: receiptAbi,
    functionName: "ownerOf",
    args: [1n],
  });
  const metadata = decodeDataUriJson(tokenUri);

  console.log(`Monad tx: ${monadTx}`);
  console.log(`Token #1 owner: ${owner}`);
  console.log(`Token #1 metadata name: ${metadata?.name ?? "(unreadable)"}`);
  console.log(`Token #1 image: ${metadata?.image ?? "(unreadable)"}`);
}

main().catch((error) => {
  console.error(`mint-one error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  if (error?.cause) {
    console.error("Cause:", error.cause);
  }
  process.exit(1);
});
