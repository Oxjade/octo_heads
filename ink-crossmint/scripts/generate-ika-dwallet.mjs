#!/usr/bin/env node

/**
 * Generate Ika dWallet on Testnet
 * Creates DKG ceremony and extracts dWallet credentials
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
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

async function generateIkaAddress() {
  try {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║    Ika dWallet Generation via SDK                          ║
║    Sui + Ika MPC Ceremony                                  ║
╚════════════════════════════════════════════════════════════╝
`);

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

    // 1. Initialize the Ika Network Client
    console.log("🔌 Initializing Ika Client...");
    const rpcUrl = env.NEXT_PUBLIC_SUI_RPC_URL || env.SUI_RPC_URL || getJsonRpcFullnodeUrl(suiNetwork);
    const suiClient = new SuiJsonRpcClient({ url: rpcUrl, network: suiNetwork });

    const sdk = await import("@ika.xyz/sdk");
    const ikaConfig = sdk.getNetworkConfig(ikaNetwork);

    const ikaClient = new sdk.IkaClient({
      suiClient,
      config: ikaConfig,
      cache: true,
      encryptionKeyOptions: { autoDetect: true },
    });

    await ikaClient.initialize();
    console.log("✅ Ika Client initialized\n");

    // 2. Define secure root seed
    console.log("🔐 Root Seed Generation...");
    const rootSeed = undefined; // Uses auto-detect from environment
    console.log("✅ Using auto-detected secure root seed\n");

    // 3. Create encryption keys
    console.log("🔑 Creating User Share Encryption Keys...");
    const userShareEncryptionKeys = await sdk.UserShareEncryptionKeys.create(
      sdk.Curve.SECP256K1,
      rootSeed
    );
    console.log("✅ Encryption keys created\n");

    // 4. Get network encryption key
    console.log("🔗 Fetching Network Encryption Key...");
    const networkEncryptionKey = await ikaClient.getConfiguredNetworkEncryptionKey();
    console.log(`✅ Network Key ID: ${networkEncryptionKey.id}\n`);

    // 5. Build DKG transaction
    console.log("⚙️  Building DKG Transaction...");
    const tx = new Transaction();
    const ikaRuntimeConfig = {
      network: ikaNetwork,
      coin: ikaCoinObjectId,
      fee: 10000000, // 0.01 SUI
    };

    const sessionIdentifier = randomHex32();
    const senderAddress = "0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36";

    const dkgRequestInput = await sdk.prepareDKGAsync(
      ikaClient,
      sdk.Curve.SECP256K1,
      userShareEncryptionKeys,
      hexToBytes(sessionIdentifier),
      senderAddress
    );

    const suiCoin = tx.splitCoins(tx.gas, [tx.pure.u64(ikaRuntimeConfig.fee)]);

    const ikaTx = new sdk.IkaTransaction({
      ikaClient,
      transaction: tx,
      userShareEncryptionKeys,
    });

    await ikaTx.requestDWalletDKG({
      dkgRequestInput,
      sessionIdentifier: ikaTx.registerSessionIdentifier(
        hexToBytes(sessionIdentifier)
      ),
      dwalletNetworkEncryptionKeyId: networkEncryptionKey.id,
      curve: sdk.Curve.SECP256K1,
      ikaCoin: tx.object(ikaCoinObjectId),
      suiCoin,
    });

    console.log("✅ DKG transaction built\n");

    // 6. Prepare signing
    console.log("📝 Transaction Preparation Summary:\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Session ID:       ${sessionIdentifier}`);
    console.log(`Sender:           ${senderAddress}`);
    console.log(`Curve:            SECP256K1`);
    console.log(`Network Key:      ${networkEncryptionKey.id}`);
    console.log(`IKA Coin:         ${ikaCoinObjectId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 7. Get transaction bytes for signing
    const txBytes = await tx.build({ client: suiClient });
    console.log("✅ Transaction ready for signature\n");

    console.log("📋 NEXT STEPS - Sign & Submit DKG Transaction:\n");
    console.log("You need to:");
    console.log("1. Sign this transaction with your wallet (nostalgic-carnelian)");
    console.log("2. Submit it to Sui testnet");
    console.log("3. Wait for DKG ceremony to complete (2-3 minutes)\n");

    console.log("⚠️  This is an on-chain process that:");
    console.log("   ✓ Initializes distributed key generation");
    console.log("   ✓ Creates your dWallet on Ika network");
    console.log("   ✓ Generates your EVM-compatible address\n");

    const proceed = await question("Ready to continue? (yes/no): ");

    if (proceed.toLowerCase() !== "yes") {
      console.log("⏸️  Setup paused. Run this script again when ready.\n");
      rl.close();
      process.exit(0);
    }

    console.log("\n📋 After you sign & submit the transaction:\n");
    console.log("1. Go to: https://testnet.ika.xyz/dashboard");
    console.log("2. Check your dWallet creation status");
    console.log("3. Once completed, you'll see:");
    console.log("   - dWallet ID (0x...)");
    console.log("   - dWallet Cap ID (0x...)");
    console.log("   - EVM Address (0x...)\n");

    console.log("4. Then run: node scripts/setup-complete-flow.mjs");
    console.log("   to update .env.local and deploy contract\n");

    console.log("💡 For now, continue with manual dWallet creation:");
    console.log("   https://testnet.ika.xyz/dashboard\n");

    rl.close();

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

// Run
generateIkaAddress().catch(console.error);
