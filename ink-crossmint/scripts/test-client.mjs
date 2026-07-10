import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { IkaClient, getNetworkConfig } from "@ika.xyz/sdk";
import * as dns from "dns";
import * as fs from "fs";
import * as path from "path";

dns.setDefaultResultOrder?.("ipv4first");

const envPath = path.join(process.cwd(), ".env.local");
const env = {};
const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const separator = trimmed.indexOf("=");
  env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
}

const network = env.NEXT_PUBLIC_IKA_NETWORK ?? env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet";
const suiClient = new SuiJsonRpcClient({
  url: env.NEXT_PUBLIC_SUI_RPC_URL ?? env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
  network,
});

console.log("Constructing IkaClient...");
try {
  const ikaClient = new IkaClient({
    suiClient,
    config: getNetworkConfig(network),
    cache: true,
  });
  console.log("IkaClient constructed. Calling initialize()...");
  await retryNetworkRead(() => ikaClient.initialize());
  console.log("IkaClient initialized successfully!");
} catch (error) {
  console.error("IkaClient initialization failed:", error);
  process.exit(1);
}

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
