const expectedChainId = Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || 143);
const rpcUrls = [
  ...(process.env.NEXT_PUBLIC_MONAD_RPC_URL ? process.env.NEXT_PUBLIC_MONAD_RPC_URL.split(",") : []),
  "https://rpc.monad.xyz",
  "https://monad-mainnet.drpc.org",
].map((url) => url.trim()).filter(Boolean);

let lastError;

for (const rpcUrl of rpcUrls) {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const chainId = Number.parseInt(payload.result, 16);

    if (chainId !== expectedChainId) {
      throw new Error(`Expected chain ${expectedChainId}, got ${chainId}`);
    }

    console.log(`Monad RPC OK: chainId ${chainId} via ${rpcUrl}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

throw lastError ?? new Error("No Monad RPC URLs configured.");
