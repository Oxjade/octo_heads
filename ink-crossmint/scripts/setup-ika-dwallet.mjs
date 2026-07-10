#!/usr/bin/env node

/**
 * Setup script to create an Ika dWallet on testnet
 * 
 * Prerequisites:
 * 1. Have IKA testnet tokens in your Sui address
 * 2. Set NEXT_PUBLIC_IKA_COIN_OBJECT_ID in .env (funded IKA coin)
 * 3. Run: node scripts/setup-ika-dwallet.mjs
 * 
 * Output: dWallet ID, Cap ID, and EVM address to add to .env
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");

function loadEnv() {
  const envFile = fs.existsSync(envPath) ? envPath : path.join(process.cwd(), ".env");
  if (!fs.existsSync(envFile)) {
    console.error("❌ No .env or .env.local found");
    process.exit(1);
  }

  const content = fs.readFileSync(envFile, "utf-8");
  const env = {};
  content.split("\n").forEach((line) => {
    const [key, val] = line.split("=");
    if (key && val) env[key.trim()] = val.trim();
  });
  return env;
}

async function main() {
  try {
    console.log("🚀 Ika dWallet Setup on Testnet\n");

    const env = loadEnv();
    const suiNetwork = env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
    const ikaNetwork = env.NEXT_PUBLIC_IKA_NETWORK || "testnet";
    const ikaCoinObjectId = env.NEXT_PUBLIC_IKA_COIN_OBJECT_ID;

    if (!ikaCoinObjectId) {
      console.error("❌ NEXT_PUBLIC_IKA_COIN_OBJECT_ID not set in .env");
      console.log("   Get a funded IKA coin from Ika testnet faucet first.");
      process.exit(1);
    }

    console.log(`📡 Network: ${suiNetwork} (Ika: ${ikaNetwork})`);
    console.log(`💰 IKA Coin: ${ikaCoinObjectId}\n`);

    // Initialize Sui client
    const rpcUrl = env.NEXT_PUBLIC_SUI_RPC_URL || env.SUI_RPC_URL || getJsonRpcFullnodeUrl(suiNetwork);
    const suiClient = new SuiJsonRpcClient({ url: rpcUrl, network: suiNetwork });

    // Load SDK
    const sdk = await import("@ika.xyz/sdk");
    const ikaConfig = sdk.getNetworkConfig(ikaNetwork);

    console.log("📦 Initializing Ika client...");
    const ikaClient = new sdk.IkaClient({
      suiClient,
      config: ikaConfig,
      cache: true,
      encryptionKeyOptions: { autoDetect: true },
    });

    await ikaClient.initialize();
    console.log("✅ Ika client initialized\n");

    // Get network encryption key
    console.log("🔑 Fetching network encryption key...");
    const networkEncryptionKey = await ikaClient.getConfiguredNetworkEncryptionKey();
    console.log(`✅ Encryption Key ID: ${networkEncryptionKey.id}\n`);

    // Step 1: Register Encryption Key
    console.log("step 1️⃣  Registering encryption key...");
    const rootSeed = undefined; // Uses auto-detect
    const userShareEncryptionKeys = await sdk.UserShareEncryptionKeys.create(
      sdk.Curve.SECP256K1,
      rootSeed
    );

    const registerTx = new Transaction();
    const ikaRegisterTx = new sdk.IkaTransaction({
      ikaClient,
      transaction: registerTx,
      userShareEncryptionKeys,
    });

    await ikaRegisterTx.registerEncryptionKey({ curve: sdk.Curve.SECP256K1 });

    console.log(
      "📝 Register Encryption Key transaction built. You would sign & submit this in browser context.\n"
    );

    // Step 2: Initiate DKG
    console.log("step 2️⃣  Building DKG request...");
    const sessionIdentifier = randomHex32();
    const senderAddress = env.SUI_ACTIVE_ADDRESS || "0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36";

    const dkgRequestInput = await sdk.prepareDKGAsync(
      ikaClient,
      sdk.Curve.SECP256K1,
      userShareEncryptionKeys,
      hexToBytes(sessionIdentifier),
      senderAddress
    );

    console.log(`📋 DKG Request Input ready (session: ${sessionIdentifier.slice(0, 10)}...)`);
    console.log(`🚨 IMPORTANT: The DKG phase requires browser interaction.`);
    console.log(`   You'll need to:
   1. Approve DKG transaction in your wallet
   2. Complete distributed key generation ceremony
   3. Wait for dWallet creation to finalize\n`);

    console.log("💡 To complete dWallet setup:");
    console.log("   1. Go to https://docs.ika.xyz/docs/core-concepts/dwallets");
    console.log("   2. Use the Ika dApp or call SDK methods directly");
    console.log("   3. Once dWallet is created, extract:");
    console.log("      - NEXT_PUBLIC_IKA_DWALLET_ID");
    console.log("      - NEXT_PUBLIC_IKA_DWALLET_CAP_ID");
    console.log("      - NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS\n");

    console.log("🔗 Quick links:");
    console.log("   - Ika Testnet: https://testnet.ika.xyz");
    console.log("   - Docs: https://docs.ika.xyz");
    console.log("   - Explorer: https://testnet-explorer.ika.xyz\n");

    // Show what we prepared
    console.log("📊 Session Data (save for reference):");
    console.log(JSON.stringify(
      {
        network: ikaNetwork,
        senderAddress,
        sessionIdentifier,
        curve: "SECP256K1",
        ikaCoinObjectId,
        networkEncryptionKeyId: networkEncryptionKey.id,
      },
      null,
      2
    ));
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

function randomHex32() {
  return "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const str = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(str.length / 2);
  for (let i = 0; i < str.length; i += 2) {
    bytes[i / 2] = parseInt(str.substr(i, 2), 16);
  }
  return bytes;
}

main();
