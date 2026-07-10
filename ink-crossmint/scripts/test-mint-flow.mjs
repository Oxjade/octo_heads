#!/usr/bin/env node

/**
 * Test complete Ink Genesis Pass mint flow
 * Sui payment → Ika MPC sign → Monad mint
 * 
 * Prerequisites:
 * 1. Dev server running: npm run dev
 * 2. All env vars in .env.local populated
 * 3. Some MON on deployer account (for gas)
 * 4. Some SUI on wallet (for payment)
 * 
 * Usage: node scripts/test-mint-flow.mjs
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { getNetworkConfig } from "@ika.xyz/sdk";
import * as dns from "dns";
import * as fs from "fs";
import * as path from "path";

dns.setDefaultResultOrder?.("ipv4first");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
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

async function main() {
  try {
    console.log("🧪 Testing Ink Genesis Pass Mint Flow\n");

    const env = loadEnv();

    // Validate all required env vars
    const required = [
      "NEXT_PUBLIC_SUI_NETWORK",
      "NEXT_PUBLIC_SUI_PACKAGE_ID",
      "NEXT_PUBLIC_SUI_COLLECTION_ID",
      "NEXT_PUBLIC_IKA_NETWORK",
      "NEXT_PUBLIC_IKA_COIN_OBJECT_ID",
      "NEXT_PUBLIC_IKA_DWALLET_ID",
      "NEXT_PUBLIC_IKA_DWALLET_CAP_ID",
      "NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS",
      "NEXT_PUBLIC_MONAD_RPC_URL",
      "NEXT_PUBLIC_MONAD_CHAIN_ID",
      "NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT",
    ];

    const missing = required.filter((v) => !env[v] || env[v] === "");
    if (missing.length > 0) {
      console.error("❌ Missing required env vars:");
      missing.forEach((v) => console.log(`   - ${v}`));
      console.log("\nUpdate .env.local with all values and retry.\n");
      process.exit(1);
    }

    console.log("✅ Configuration:");
    console.log(`   Sui Network: ${env.NEXT_PUBLIC_SUI_NETWORK}`);
    console.log(`   Ika Network: ${env.NEXT_PUBLIC_IKA_NETWORK}`);
    console.log(`   Monad Chain: ${env.NEXT_PUBLIC_MONAD_CHAIN_ID}`);
    console.log(`   Package: ${env.NEXT_PUBLIC_SUI_PACKAGE_ID.slice(0, 10)}...`);
    console.log(`   Collection: ${env.NEXT_PUBLIC_SUI_COLLECTION_ID.slice(0, 10)}...`);
    console.log(`   Monad Contract: ${env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT.slice(0, 10)}...\n`);

    // Test Sui connectivity
    console.log("🔌 Testing Sui connectivity...");
    const suiNetwork = env.NEXT_PUBLIC_SUI_NETWORK;
    const defaultSuiRpcUrl = getJsonRpcFullnodeUrl(
      suiNetwork === "mainnet" ? "mainnet" : suiNetwork === "devnet" ? "devnet" : "testnet"
    );
    const suiRpcUrl = env.NEXT_PUBLIC_SUI_RPC_URL || env.SUI_RPC_URL || defaultSuiRpcUrl;
    const suiClient = new SuiJsonRpcClient({
      url: suiRpcUrl,
      network: suiNetwork === "mainnet" ? "mainnet" : suiNetwork === "devnet" ? "devnet" : "testnet",
    });

    try {
      const status = await retryNetworkRead(() => suiClient.getRpcApiVersion());
      console.log(`✅ Sui ${suiNetwork} connected (API: ${status})\n`);
    } catch (e) {
      console.error(`❌ Sui connection failed: ${e.message}\n`);
      process.exit(1);
    }

    // Test Ika SDK
    console.log("🔌 Testing Ika SDK...");
    try {
      const sdk = await import("@ika.xyz/sdk");
      const ikaConfig = sdk.getNetworkConfig(env.NEXT_PUBLIC_IKA_NETWORK);
      const ikaClient = new sdk.IkaClient({
        suiClient,
        config: ikaConfig,
        cache: true,
        encryptionKeyOptions: { autoDetect: true },
      });
      await retryNetworkRead(() => ikaClient.initialize());
      console.log(`✅ Ika SDK initialized\n`);
    } catch (e) {
      console.error(`❌ Ika SDK failed: ${e.message}\n`);
      process.exit(1);
    }

    // Test Monad RPC
    console.log("🔌 Testing Monad RPC...");
    try {
      const response = await fetch(env.NEXT_PUBLIC_MONAD_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      const data = await response.json();
      const chainId = parseInt(data.result, 16);
      console.log(`✅ Monad connected (Chain ID: ${chainId})\n`);

      if (chainId !== Number(env.NEXT_PUBLIC_MONAD_CHAIN_ID)) {
        console.error(`❌ Chain ID mismatch. Expected ${env.NEXT_PUBLIC_MONAD_CHAIN_ID}, got ${chainId}\n`);
        process.exit(1);
      }
    } catch (e) {
      console.error(`❌ Monad RPC failed: ${e.message}\n`);
      process.exit(1);
    }

    console.log("✅ All systems ready!\n");
    console.log("🎯 Next steps:");
    console.log("   1. Start dev server: npm run dev");
    console.log("   2. Go to: http://localhost:3001/mint");
    console.log("   3. Connect wallet (nostalgic-carnelian)");
    console.log("   4. Click 'Mint NFT'");
    console.log("\n   Flow:");
    console.log(`   ✓ Pay ${env.NEXT_PUBLIC_MINT_PRICE ?? "0.1"} SUI on Sui ${env.NEXT_PUBLIC_SUI_NETWORK}`);
    console.log("   ✓ Request Ika MPC signature");
    console.log("   ✓ Submit to Monad");
    console.log("   ✓ NFT minted to dWallet EVM address\n");

    console.log("📊 Useful links:");
    console.log(`   - App: http://localhost:3001/mint`);
    console.log(`   - Sui package: ${env.NEXT_PUBLIC_SUI_PACKAGE_ID}`);
    console.log(`   - Monad contract: ${env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT}`);
    console.log(`   - Ika network: ${env.NEXT_PUBLIC_IKA_NETWORK}\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();

async function retryNetworkRead(operation) {
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
      if (!/network error|failed to fetch|fetch failed|timeout|etimedout/i.test(`${message} ${cause}`) || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }

  throw lastError;
}
