#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as dns from "dns";
import { createInkClient, IkaEvmSigningConnector } from "@ink-sdk/sdk";
import { Curve, UserShareEncryptionKeys } from "@ika.xyz/sdk";

const DEFAULT_ENV_FILE = ".env.local";
const MONAD_MAINNET_CHAIN_ID = 143;
const DEFAULT_SUI_TESTNET_RPC = "https://sui-testnet-rpc.publicnode.com";
const FETCH_RETRIES = 6;

dns.setDefaultResultOrder?.("ipv4first");
installFetchRetry();

function printHelp() {
  console.log(`Ink CLI

Usage:
  npm run cli -- create [options]

Options:
  --env-file <path>       Env file to read/write. Defaults to .env.local, then .env.
  --network <name>        Ika/Sui network name. Defaults to testnet.
  --rpc <url>             Sui RPC URL used for dWallet creation.
  --ika-coin <id>         IKA coin object ID for protocol fees.
  --sui-coin <id>         SUI coin object ID used by the Ika flow.
  --gas-coin <id>         SUI gas coin object ID.
  --write-env             Write generated IDs back to the env file. Default.
  --no-write-env          Print only; do not modify env file.
  --json                  Print machine-readable output.
  --help                  Show this help.

Required env:
  IKA_SUI_PRIVATE_KEY     Sui ED25519 private key for submitting Ika transactions.
  IKA_COIN_ID             IKA coin object ID. Falls back to NEXT_PUBLIC_IKA_COIN_OBJECT_ID.
  IKA_SUI_COIN_ID         SUI coin object ID for the Ika flow.
`);
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  const options = {
    command,
    envFile: undefined,
    network: undefined,
    rpc: undefined,
    ikaCoin: undefined,
    suiCoin: undefined,
    gasCoin: undefined,
    writeEnv: true,
    json: false,
    help: false,
  };

  if (command === "--help" || command === "-h") {
    options.command = undefined;
    options.help = true;
    return options;
  }

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const next = () => {
      const value = tokens[++index];
      if (!value || value.startsWith("--")) {
        throw new Error(`${token} requires a value`);
      }
      return value;
    };

    switch (token) {
      case "--env-file":
        options.envFile = next();
        break;
      case "--network":
        options.network = next();
        break;
      case "--rpc":
        options.rpc = next();
        break;
      case "--ika-coin":
        options.ikaCoin = next();
        break;
      case "--sui-coin":
        options.suiCoin = next();
        break;
      case "--gas-coin":
        options.gasCoin = next();
        break;
      case "--write-env":
        options.writeEnv = true;
        break;
      case "--no-write-env":
        options.writeEnv = false;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return options;
}

function resolveEnvFile(file) {
  if (file) return path.resolve(process.cwd(), file);

  const local = path.resolve(process.cwd(), DEFAULT_ENV_FILE);
  if (fs.existsSync(local)) return local;

  return path.resolve(process.cwd(), ".env");
}

function parseEnvFile(filePath) {
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").split(/\r?\n/) : [];
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return { env, lines };
}

function writeEnvFile(filePath, lines, updates) {
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

function withInkEnv(rawEnv, options) {
  const env = {
    ...process.env,
    ...rawEnv,
  };

  env.IKA_NETWORK = options.network ?? env.IKA_NETWORK ?? env.NEXT_PUBLIC_IKA_NETWORK ?? "testnet";
  env.IKA_SUI_RPC = options.rpc ?? env.IKA_SUI_RPC ?? env.NEXT_PUBLIC_SUI_RPC_URL ?? DEFAULT_SUI_TESTNET_RPC;
  env.IKA_COIN_ID = options.ikaCoin ?? env.IKA_COIN_ID ?? env.NEXT_PUBLIC_IKA_COIN_OBJECT_ID;
  env.IKA_SUI_COIN_ID = options.suiCoin ?? env.IKA_SUI_COIN_ID;
  env.IKA_GAS_COIN_ID = options.gasCoin ?? env.IKA_GAS_COIN_ID;
  env.IKA_SIGN_TIMEOUT_MS = env.IKA_SIGN_TIMEOUT_MS ?? env.NEXT_PUBLIC_IKA_SIGN_TIMEOUT_MS;
  env.IKA_USER_SHARE_ENCRYPTION_KEYS_B64 =
    options.userShareEncryptionKeysB64 ?? env.IKA_USER_SHARE_ENCRYPTION_KEYS_B64;

  return env;
}

function requireEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}\n` +
        `Add them to your env file or pass the matching CLI flags.`,
    );
  }
}

function walletToUpdates(wallet, env) {
  const evmAddress = wallet.addresses?.evm;
  const dWalletCapId = wallet.metadata?.dWalletCapId;
  const presignId = wallet.metadata?.presignId;
  const unverifiedPresignCapId = wallet.metadata?.unverifiedPresignCapId;
  const encryptedShareId = wallet.metadata?.encryptedUserSecretKeyShareId;

  return {
    IKA_NETWORK: env.IKA_NETWORK,
    IKA_SUI_RPC: env.IKA_SUI_RPC ?? "",
    IKA_COIN_ID: env.IKA_COIN_ID,
    IKA_SUI_COIN_ID: env.IKA_SUI_COIN_ID,
    IKA_GAS_COIN_ID: env.IKA_GAS_COIN_ID ?? "",
    IKA_DWALLET_ID: wallet.id,
    IKA_DWALLET_CAP_ID: dWalletCapId,
    IKA_ETH_ADDRESS: evmAddress,
    IKA_PRESIGN_ID: presignId,
    IKA_UNVERIFIED_PRESIGN_CAP_ID: unverifiedPresignCapId,
    IKA_ENCRYPTED_USER_SECRET_KEY_SHARE_ID: encryptedShareId ?? "",
    IKA_USER_SHARE_ENCRYPTION_KEYS_B64: env.IKA_USER_SHARE_ENCRYPTION_KEYS_B64 ?? "",
    NEXT_PUBLIC_IKA_NETWORK: env.IKA_NETWORK,
    NEXT_PUBLIC_IKA_COIN_OBJECT_ID: env.IKA_COIN_ID,
    NEXT_PUBLIC_IKA_DWALLET_ID: wallet.id,
    NEXT_PUBLIC_IKA_DWALLET_CAP_ID: dWalletCapId,
    NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS: evmAddress,
  };
}

async function createDWallet(options) {
  const envFile = resolveEnvFile(options.envFile);
  const { env: fileEnv, lines } = parseEnvFile(envFile);
  if (!fileEnv.IKA_USER_SHARE_ENCRYPTION_KEYS_B64) {
    options.userShareEncryptionKeysB64 = await createUserShareEncryptionKeysB64();
  }
  const env = withInkEnv(fileEnv, options);

  requireEnv(env, ["IKA_SUI_PRIVATE_KEY", "IKA_COIN_ID", "IKA_SUI_COIN_ID"]);

  const chain = {
    type: "evm",
    chainId: Number(env.NEXT_PUBLIC_MONAD_CHAIN_ID ?? MONAD_MAINNET_CHAIN_ID),
    rpcUrl: env.NEXT_PUBLIC_MONAD_RPC_URL,
  };
  const ink = createInkClient({
    mode: "production",
    ika: {
      connector: new IkaEvmSigningConnector({ env }),
      network: env.IKA_NETWORK,
    },
    chains: [chain],
  });

  if (!options.json) {
    console.log(`Creating Ink/Ika EVM dWallet on ${env.IKA_NETWORK}...`);
  }

  const wallet = await ink.dwallet.create({
    name: "ink-crossmint-monad",
    chains: [chain],
    config: {
      app: "ink-crossmint",
      target: chain.chainId === 143 ? "monad-mainnet" : "monad-testnet",
    },
  });
  const updates = walletToUpdates(wallet, env);

  if (options.writeEnv) {
    writeEnvFile(envFile, lines, updates);
  }

  const result = {
    envFile,
    wroteEnv: options.writeEnv,
    wallet,
    env: updates,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Ink dWallet created");
  console.log(`  dWallet ID: ${wallet.id}`);
  console.log(`  EVM address: ${wallet.addresses?.evm}`);
  console.log(`  dWallet cap ID: ${wallet.metadata?.dWalletCapId}`);
  console.log(`  Presign ID: ${wallet.metadata?.presignId}`);
  if (options.writeEnv) {
    console.log(`  Updated: ${envFile}`);
  }
}

async function createUserShareEncryptionKeysB64() {
  const rootSeed = crypto.getRandomValues(new Uint8Array(32));
  const keys = await UserShareEncryptionKeys.fromRootSeedKey(rootSeed, Curve.SECP256K1);
  return Buffer.from(keys.toShareEncryptionKeysBytes()).toString("base64");
}

function installFetchRetry() {
  if (typeof globalThis.fetch !== "function") return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    let lastError;

    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        return await originalFetch(input, init);
      } catch (error) {
        lastError = error;
        if (!isRetryableFetchError(error) || attempt === FETCH_RETRIES) break;
        await delay(250 * attempt);
      }
    }

    throw lastError;
  };
}

function isRetryableFetchError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error?.cause;
  const causeText = cause instanceof Error ? `${cause.name} ${cause.message} ${cause.code ?? ""}` : String(cause ?? "");

  return /fetch failed|ETIMEDOUT|ENETUNREACH|ECONNRESET|EAI_AGAIN/i.test(`${message} ${causeText}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help || !options.command) {
      printHelp();
      return;
    }

    if (options.command !== "create") {
      throw new Error(`Unknown command: ${options.command}`);
    }

    await createDWallet(options);
  } catch (error) {
    console.error(`Ink CLI error: ${error instanceof Error ? error.message : String(error)}`);
    if (process.env.INK_CLI_DEBUG === "1" && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
