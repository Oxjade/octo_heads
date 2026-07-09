import { createPublicClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const expectedChainId = Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || 143);
const rpcUrls = [
  ...(process.env.NEXT_PUBLIC_MONAD_RPC_URL ? process.env.NEXT_PUBLIC_MONAD_RPC_URL.split(",") : []),
  "https://rpc.monad.xyz",
  "https://monad-mainnet.drpc.org",
].map((url) => url.trim()).filter(Boolean);

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

let lastError;

for (const rpcUrl of rpcUrls) {
  try {
    const monadTestnet = {
      id: expectedChainId,
      name: expectedChainId === 143 ? "Monad Mainnet" : "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    };

    const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) });
    const chainId = await client.getChainId();

    if (chainId !== expectedChainId) {
      throw new Error(`Expected Monad chain ${expectedChainId}, got ${chainId}`);
    }

    const balance = await client.getBalance({ address: account.address });

    console.log(`dWallet OK on Monad: ${account.address}`);
    console.log(`Balance readable: ${balance} wei via ${rpcUrl}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

throw lastError ?? new Error("No Monad RPC URLs configured.");
