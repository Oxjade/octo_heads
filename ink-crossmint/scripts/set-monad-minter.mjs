#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const envPath = path.join(process.cwd(), ".env.local");

function loadEnv() {
  const env = { ...process.env };
  if (!fs.existsSync(envPath)) return env;

  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return env;
}

const abi = parseAbi([
  "function owner() view returns (address)",
  "function ikaMinter() view returns (address)",
  "function setIkaMinter(address newIkaMinter)",
]);

async function main() {
  const env = loadEnv();
  const rpcUrl = env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://rpc.monad.xyz";
  const chainId = Number(env.NEXT_PUBLIC_MONAD_CHAIN_ID || 143);
  const contract = env.NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT;
  const newMinter = process.argv[2] ?? env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS ?? env.IKA_ETH_ADDRESS;
  let privateKey = env.MONAD_PRIVATE_KEY;

  if (!contract) throw new Error("NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT is not set.");
  if (!newMinter) throw new Error("Pass a minter address or set NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS.");
  if (!privateKey) throw new Error("MONAD_PRIVATE_KEY is not set. Export the deployer/owner private key first.");
  if (!privateKey.startsWith("0x")) privateKey = `0x${privateKey}`;

  const chain = defineChain({
    id: chainId,
    name: chainId === 143 ? "Monad Mainnet" : "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const [owner, currentMinter] = await Promise.all([
    publicClient.readContract({ address: contract, abi, functionName: "owner" }),
    publicClient.readContract({ address: contract, abi, functionName: "ikaMinter" }),
  ]);

  if (getAddress(owner) !== getAddress(account.address)) {
    throw new Error(`Private key is ${account.address}, but contract owner is ${owner}.`);
  }

  if (getAddress(currentMinter) === getAddress(newMinter)) {
    console.log(`Monad ikaMinter already set: ${currentMinter}`);
    return;
  }

  const hash = await walletClient.writeContract({
    address: contract,
    abi,
    functionName: "setIkaMinter",
    args: [newMinter],
    account,
  });
  console.log(`Submitted setIkaMinter: ${hash}`);

  await publicClient.waitForTransactionReceipt({ hash });
  const updated = await publicClient.readContract({ address: contract, abi, functionName: "ikaMinter" });
  console.log(`Updated ikaMinter: ${updated}`);
}

main().catch((error) => {
  console.error(`set-monad-minter error: ${error.message}`);
  process.exit(1);
});
