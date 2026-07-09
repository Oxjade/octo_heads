#!/usr/bin/env node

/**
 * Deploy InkPassReceipt.sol to Monad
 *
 * Prerequisites:
 * 1. Have .env.local with NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS set
 * 2. Export MONAD_PRIVATE_KEY or add to .env.local
 *
 * Usage:
 *   export MONAD_PRIVATE_KEY=0x...
 *   npm run deploy:monad
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(process.cwd(), ".env.local");
const contractName = "InkPassReceipt";
const contractFile = "InkPassReceipt.sol";

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error("❌ No .env.local found");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return;
    const key = trimmed.slice(0, separator).trim();
    const val = trimmed.slice(separator + 1).trim();
    if (key) env[key] = val;
  });
  return env;
}

function saveEnv(env) {
  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(envPath, content);
}

function compileContract() {
  const contractPath = path.join(process.cwd(), "contracts/monad", contractFile);
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not found: ${contractPath}`);
  }

  const source = fs.readFileSync(contractPath, "utf-8");
  const input = {
    language: "Solidity",
    sources: {
      [contractFile]: { content: source },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((error) => error.severity === "error");

  for (const error of errors) {
    const prefix = error.severity === "error" ? "❌" : "⚠️";
    console.log(`${prefix} ${error.formattedMessage.trim()}`);
  }

  if (fatalErrors.length > 0) {
    throw new Error("Solidity compilation failed");
  }

  const contract = output.contracts?.[contractFile]?.[contractName];
  if (!contract?.abi || !contract?.evm?.bytecode?.object) {
    throw new Error(`Missing compiled artifact for ${contractName}`);
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

async function main() {
  try {
    console.log("🚀 Deploying InkPassReceipt to Monad\n");

    const env = loadEnv();
    const rpcUrl = env.NEXT_PUBLIC_MONAD_RPC_URL;
    const chainId = Number(env.NEXT_PUBLIC_MONAD_CHAIN_ID || 143);
    const ikaEVMAddress = env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS;

    if (!rpcUrl) {
      console.error("❌ NEXT_PUBLIC_MONAD_RPC_URL not set");
      process.exit(1);
    }

    if (!ikaEVMAddress) {
      console.error("❌ NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS not set");
      console.log("   First generate a dWallet in useink.xyz and save its EVM address to .env.local");
      process.exit(1);
    }

    // Get private key from env or process.env
    let privateKey = env.MONAD_PRIVATE_KEY || process.env.MONAD_PRIVATE_KEY;

    if (!privateKey) {
      console.error("❌ MONAD_PRIVATE_KEY not set");
      console.log("   Add to .env.local: MONAD_PRIVATE_KEY=0x...");
      console.log("   Or export: export MONAD_PRIVATE_KEY=0x...\n");
      process.exit(1);
    }

    // Ensure private key has 0x prefix
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    console.log(`📡 RPC: ${rpcUrl}`);
    console.log(`🔗 Chain ID: ${chainId}`);
    console.log(`📝 IKA Signer: ${ikaEVMAddress}\n`);

    const monad = defineChain({
      id: chainId,
      name: chainId === 143 ? "Monad Mainnet" : "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      blockExplorers: {
        default: { name: "Monad Explorer", url: chainId === 143 ? "https://monadvision.com" : "https://testnet.monadexplorer.com" },
      },
    });
    const transport = http(rpcUrl);
    const publicClient = createPublicClient({ chain: monad, transport });
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: monad,
      transport,
    });

    console.log(`💼 Deployer: ${account.address}`);
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`💰 Balance: ${formatEther(balance)} MON\n`);

    if (balance === 0n) {
      console.error("❌ No MON balance for deployment gas.");
      process.exit(1);
    }

    const remoteChainId = await publicClient.getChainId();
    if (remoteChainId !== chainId) {
      throw new Error(`RPC chain ID mismatch: expected ${chainId}, got ${remoteChainId}`);
    }

    console.log("📦 Compiling InkPassReceipt.sol...");
    const { abi, bytecode } = compileContract();

    console.log("🚀 Broadcasting deployment...");
    const hash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [ikaEVMAddress],
    });

    console.log(`⏳ Transaction: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (!receipt.contractAddress) {
      throw new Error("Deployment receipt did not include a contract address");
    }

    env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT = receipt.contractAddress;
    saveEnv(env);

    console.log("\n✅ InkPassReceipt deployed");
    console.log(`   Contract: ${receipt.contractAddress}`);
    console.log(`   Tx:       ${hash}`);
    console.log("   Saved:    NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT in .env.local\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
