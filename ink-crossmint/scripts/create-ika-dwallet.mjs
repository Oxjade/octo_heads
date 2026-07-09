#!/usr/bin/env node

/**
 * Ika dWallet Setup via Browser Dashboard
 * Most reliable way to create dWallet on testnet
 */

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
  console.log(`✅ Updated .env.local\n`);
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

async function main() {
  try {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║    Ika dWallet Setup - Browser Dashboard                   ║
║    Create dWallet on Ika Testnet                           ║
╚════════════════════════════════════════════════════════════╝
`);

    const env = loadEnv();

    console.log("📍 Your Active Address:");
    console.log("   0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36\n");

    console.log("💰 Funded IKA Coin:");
    console.log(`   ${env.NEXT_PUBLIC_IKA_COIN_OBJECT_ID}\n`);

    console.log("════════════════════════════════════════════════════════════\n");
    console.log("📝 STEP 1: Create dWallet\n");

    console.log("🌐 Open in your browser:");
    console.log("   https://testnet.ika.xyz/dashboard\n");

    console.log("👛 Connect Wallet:");
    console.log("   1. Click 'Connect Wallet'");
    console.log("   2. Select MetaMask or your wallet");
    console.log("   3. Choose address: nostalgic-carnelian");
    console.log("      (0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36)\n");

    console.log("🎛️  Create dWallet:");
    console.log("   1. Click 'Create dWallet' or similar button");
    console.log("   2. Select Curve: SECP256K1");
    console.log("   3. Click 'Create'");
    console.log("   4. Complete DKG ceremony (distributed key generation)");
    console.log("      - This is an interactive multi-round process");
    console.log("      - You'll see progress updates");
    console.log("      - Takes 2-5 minutes\n");

    console.log("📋 Once DKG completes, you'll see:");
    console.log("   ✓ dWallet ID (looks like: 0x1234...abcd)");
    console.log("   ✓ dWallet Cap ID (capability object)");
    console.log("   ✓ dWallet EVM Address (0x...)\n");

    console.log("════════════════════════════════════════════════════════════\n");

    const ready = await question("Have you created your dWallet? (yes/no): ");

    if (ready.toLowerCase() !== "yes") {
      console.log("\n⏸️  Please create dWallet first, then run this script again.\n");
      rl.close();
      process.exit(0);
    }

    console.log("\n📝 STEP 2: Enter dWallet Credentials\n");

    const dwalletId = await question("Enter dWallet ID (0x...): ");
    if (!dwalletId || !dwalletId.startsWith("0x")) {
      console.error("❌ Invalid dWallet ID\n");
      rl.close();
      process.exit(1);
    }

    const dwalletCapId = await question("Enter dWallet Cap ID (0x...): ");
    if (!dwalletCapId || !dwalletCapId.startsWith("0x")) {
      console.error("❌ Invalid dWallet Cap ID\n");
      rl.close();
      process.exit(1);
    }

    const dwalletEVMAddress = await question(
      "Enter dWallet EVM Address (0x...): "
    );
    if (!dwalletEVMAddress || !dwalletEVMAddress.startsWith("0x")) {
      console.error("❌ Invalid EVM Address\n");
      rl.close();
      process.exit(1);
    }

    // Verify EVM address is valid Ethereum format
    if (dwalletEVMAddress.length !== 42) {
      console.error("❌ EVM Address should be 42 characters (0x + 40 hex)\n");
      rl.close();
      process.exit(1);
    }

    console.log("\n✅ Credentials received:\n");
    console.log(`dWallet ID:      ${dwalletId}`);
    console.log(`dWallet Cap ID:  ${dwalletCapId}`);
    console.log(`EVM Address:     ${dwalletEVMAddress}\n`);

    // Save to env
    env.NEXT_PUBLIC_IKA_DWALLET_ID = dwalletId;
    env.NEXT_PUBLIC_IKA_DWALLET_CAP_ID = dwalletCapId;
    env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS = dwalletEVMAddress;

    saveEnv(env);

    console.log("════════════════════════════════════════════════════════════\n");
    console.log("✅ dWallet Created & Saved!\n");

    console.log("📝 NEXT: Deploy InkPassReceipt to Monad\n");
    console.log("Run: node scripts/setup-complete-flow.mjs\n");

    console.log("This will guide you through:");
    console.log("1. Deploy InkPassReceipt.sol to Monad testnet");
    console.log("2. Update contract address in .env.local");
    console.log("3. Test mint flow\n");

    rl.close();

  } catch (error) {
    console.error("❌ Error:", error.message);
    rl.close();
    process.exit(1);
  }
}

main();
