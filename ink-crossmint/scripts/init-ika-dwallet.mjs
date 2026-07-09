#!/usr/bin/env node

/**
 * Initialize Ika dWallet on testnet
 * This script helps you create a dWallet through the Ika SDK
 * 
 * Usage: node scripts/init-ika-dwallet.mjs
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error("❌ No .env.local found");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  content.split("\n").forEach((line) => {
    const [key, val] = line.split("=");
    if (key && val) env[key.trim()] = val.trim();
  });
  return env;
}

function saveEnv(env) {
  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(envPath, content);
}

async function main() {
  try {
    console.log("🚀 Ika dWallet Initialization\n");

    const env = loadEnv();
    const suiNetwork = env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
    const ikaNetwork = env.NEXT_PUBLIC_IKA_NETWORK || "testnet";
    const ikaCoinObjectId = env.NEXT_PUBLIC_IKA_COIN_OBJECT_ID;

    if (!ikaCoinObjectId) {
      console.error("❌ NEXT_PUBLIC_IKA_COIN_OBJECT_ID not set");
      process.exit(1);
    }

    console.log(`📡 Network: ${suiNetwork} (Ika: ${ikaNetwork})`);
    console.log(`💰 IKA Coin: ${ikaCoinObjectId}\n`);

    const rpcUrl = getFullnodeUrl(suiNetwork);
    const suiClient = new SuiClient({ url: rpcUrl });

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
    console.log("✅ Ika client ready\n");

    // Get network encryption key
    const networkEncryptionKey = await ikaClient.getConfiguredNetworkEncryptionKey();
    console.log(`🔑 Network Encryption Key: ${networkEncryptionKey.id}\n`);

    console.log("⚠️  NEXT STEPS - Manual dWallet Creation via Ika Dashboard:\n");
    console.log("1. Open: https://testnet.ika.xyz/dashboard");
    console.log("2. Connect wallet (nostalgic-carnelian)");
    console.log("3. Create dWallet → Complete DKG ceremony");
    console.log("4. Once created, copy these values to .env.local:\n");
    console.log('   NEXT_PUBLIC_IKA_DWALLET_ID=0x...');
    console.log('   NEXT_PUBLIC_IKA_DWALLET_CAP_ID=0x...');
    console.log('   NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS=0x...\n');

    console.log("Then run: node scripts/deploy-monad.mjs\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
