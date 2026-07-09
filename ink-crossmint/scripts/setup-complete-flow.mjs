#!/usr/bin/env node

/**
 * Complete Ika dWallet + Monad Contract Setup Guide
 * Interactive walkthrough for testnet deployment
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const envPath = path.join(process.cwd(), ".env.local");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

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
  console.log(`\n✅ Saved to .env.local\n`);
}

async function main() {
  try {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║    Ink Genesis Pass - Setup Guide                          ║
║    Ika dWallet + Monad Contract Deployment                 ║
╚════════════════════════════════════════════════════════════╝
`);

    const env = loadEnv();
    const ikaEVMAddress = env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS;

    console.log("Current Status:\n");
    console.log(`📍 Active Address: 0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36`);
    console.log(`💰 IKA Coin: ${env.NEXT_PUBLIC_IKA_COIN_OBJECT_ID}`);
    console.log(`🎛️  dWallet: ${ikaEVMAddress ? "✅ Set" : "❌ Not set"}`);
    console.log(
      `📋 Monad Contract: ${env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT ? "✅ Set" : "❌ Not set"}\n`
    );

    console.log("════════════════════════════════════════════════════════════\n");

    // Step 1: Create dWallet
    if (!ikaEVMAddress) {
      console.log("📝 STEP 1: Create Ika dWallet on Testnet\n");
      console.log("Do this via browser:\n");
      console.log("   1. Go to: https://testnet.ika.xyz/dashboard");
      console.log("   2. Connect wallet (nostalgic-carnelian)");
      console.log("   3. Create dWallet → Complete DKG ceremony");
      console.log("   4. Once created, you'll have:\n");
      console.log("      - dWallet ID (0x...)");
      console.log("      - dWallet Cap ID (0x...)");
      console.log("      - dWallet EVM Address (0x...)\n");

      const proceed = await question("Have you created a dWallet? (yes/no): ");

      if (proceed.toLowerCase() === "yes") {
        const dwalletId = await question("\nEnter NEXT_PUBLIC_IKA_DWALLET_ID: ");
        const dwalletCapId = await question("Enter NEXT_PUBLIC_IKA_DWALLET_CAP_ID: ");
        const dwalletEVMAddress = await question(
          "Enter NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS: "
        );

        if (dwalletId && dwalletCapId && dwalletEVMAddress) {
          env.NEXT_PUBLIC_IKA_DWALLET_ID = dwalletId;
          env.NEXT_PUBLIC_IKA_DWALLET_CAP_ID = dwalletCapId;
          env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS = dwalletEVMAddress;
          saveEnv(env);
          console.log("✅ dWallet IDs saved");
        } else {
          console.error("❌ Missing values");
          process.exit(1);
        }
      } else {
        console.log("⏸️  Please create dWallet first, then run this script again.");
        process.exit(0);
      }
    } else {
      console.log(`✅ dWallet already configured: ${ikaEVMAddress}\n`);
    }

    console.log("════════════════════════════════════════════════════════════\n");

    // Step 2: Deploy Monad contract
    if (!env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT) {
      console.log("📝 STEP 2: Deploy InkPassReceipt to Monad Testnet\n");
      console.log(
        "Option A: Use Remix IDE (Easiest)\n"
      );
      console.log("   1. Go to: https://remix.ethereum.org");
      console.log("   2. Create new Solidity file: InkPassReceipt.sol");
      console.log(
        "   3. Copy code from: contracts/monad/InkPassReceipt.sol"
      );
      console.log("   4. Click Deploy");
      console.log("   5. Select Environment: Injected Provider (MetaMask)");
      console.log("   6. Network: Connect MetaMask to Monad testnet (10143)");
      console.log("   7. Constructor argument: " + env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS);
      console.log("   8. Click Deploy and approve transaction\n");

      console.log(
        "Option B: Use Hardhat/Foundry\n"
      );
      console.log("   1. Install: npm install --save-dev hardhat ethers");
      console.log("   2. Compile: npx hardhat compile");
      console.log("   3. Deploy: npx hardhat run scripts/deploy-receipt.js --network monad\n");

      const proceed = await question("Have you deployed the contract? (yes/no): ");

      if (proceed.toLowerCase() === "yes") {
        const contractAddress = await question(
          "\nEnter deployed contract address (0x...): "
        );

        if (contractAddress) {
          env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT = contractAddress;
          saveEnv(env);
          console.log("✅ Contract address saved");
        } else {
          console.error("❌ Invalid address");
          process.exit(1);
        }
      } else {
        console.log("⏸️  Please deploy contract first, then run this script again.");
        process.exit(0);
      }
    } else {
      console.log(
        `✅ Monad contract already deployed: ${env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT}\n`
      );
    }

    console.log("════════════════════════════════════════════════════════════\n");

    // Step 3: Prepare for testing
    console.log("✅ SETUP COMPLETE!\n");
    console.log("📝 Next: Test end-to-end mint flow\n");
    console.log("1. Start dev server:");
    console.log("   npm run dev\n");

    console.log("2. Navigate to:");
    console.log("   http://localhost:3001/mint\n");

    console.log("3. Test mint:");
    console.log("   - Connect wallet (nostalgic-carnelian)");
    console.log("   - Click 'Mint NFT'");
    console.log(`   - Pay ${env.NEXT_PUBLIC_MINT_PRICE ?? "0.1"} SUI`);
    console.log("   - Approve Ika MPC signature");
    console.log("   - NFT minted to Monad!\n");

    console.log("📊 Monitoring:");
    console.log("   - Sui: https://testnet.suivision.xyz");
    console.log("   - Monad: https://testnet-explorer.monad.xyz");
    console.log("   - Ika: https://testnet.ika.xyz/dashboard\n");

    rl.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    rl.close();
    process.exit(1);
  }
}

main();
