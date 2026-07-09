import {
  bytesToHex,
  createPublicClient,
  getAddress,
  hexToBytes,
  http,
  keccak256,
  recoverAddress,
  serializeTransaction,
  type Hex,
  type PublicClient,
} from "viem";
import { monadConfig } from "@/config/chains";
import { buildMonadReceiptMintCalldata } from "./receipt";

export type MonadMintPassTransaction = {
  chainId: number;
  type: "eip1559";
  from: `0x${string}`;
  to: `0x${string}`;
  data: Hex;
  nonce: number;
  gas: bigint;
  value: 0n;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

export function buildMonadMintPassCalldata(input: {
  monadRecipient: `0x${string}`;
  suiReceiptId: string;
  proofHash: Hex;
}) {
  return buildMonadReceiptMintCalldata({
    monadAddress: input.monadRecipient,
    suiReceiptId: input.suiReceiptId,
    proofHash: input.proofHash,
  });
}

export function buildUnsignedMonadMintPassTransaction(input: {
  ikaDWalletAddress: `0x${string}`;
  monadRecipient: `0x${string}`;
  suiReceiptId: string;
  proofHash: Hex;
  nonce: number;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  receiptContractAddress?: `0x${string}`;
  chainId?: number;
}): MonadMintPassTransaction {
  const receiptContractAddress = input.receiptContractAddress ?? (monadConfig.receiptContractAddress as `0x${string}`);

  if (!receiptContractAddress) {
    throw new Error("Configure NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT before building the Monad mint transaction.");
  }

  return {
    chainId: input.chainId ?? monadConfig.chainId,
    type: "eip1559",
    from: getAddress(input.ikaDWalletAddress) as `0x${string}`,
    to: getAddress(receiptContractAddress) as `0x${string}`,
    data: buildMonadMintPassCalldata(input),
    nonce: input.nonce,
    gas: input.gas,
    value: 0n,
    maxFeePerGas: input.maxFeePerGas,
    maxPriorityFeePerGas: input.maxPriorityFeePerGas,
  };
}

export function getUnsignedMonadTransactionBytes(transaction: MonadMintPassTransaction) {
  return hexToBytes(serializeTransaction(transaction));
}

export function getUnsignedMonadTransactionHash(transaction: MonadMintPassTransaction) {
  return keccak256(serializeTransaction(transaction));
}

export async function prepareMonadMintPassTransaction(input: {
  ikaDWalletAddress: `0x${string}`;
  monadRecipient: `0x${string}`;
  suiReceiptId: string;
  proofHash: Hex;
  receiptContractAddress?: `0x${string}`;
  client?: PublicClient;
}) {
  const client =
    input.client ??
    createPublicClient({
      chain: {
        id: monadConfig.chainId,
        name: "Monad Testnet",
        nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
        rpcUrls: { default: { http: [monadConfig.rpcUrl] } },
      },
      transport: http(monadConfig.rpcUrl),
    });

  const data = buildMonadMintPassCalldata(input);
  const to = input.receiptContractAddress ?? (monadConfig.receiptContractAddress as `0x${string}`);

  if (!to) {
    throw new Error("Configure NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT before preparing the Monad mint transaction.");
  }

  const [nonce, fees, gas] = await Promise.all([
    client.getTransactionCount({ address: input.ikaDWalletAddress }),
    client.estimateFeesPerGas(),
    client.estimateGas({
      account: input.ikaDWalletAddress,
      to,
      data,
      value: 0n,
    }),
  ]);

  const transaction = buildUnsignedMonadMintPassTransaction({
    ...input,
    receiptContractAddress: to,
    nonce,
    gas,
    maxFeePerGas: fees.maxFeePerGas ?? fees.gasPrice ?? 0n,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n,
  });

  return {
    transaction,
    unsignedBytes: getUnsignedMonadTransactionBytes(transaction),
    unsignedHash: getUnsignedMonadTransactionHash(transaction),
  };
}

export async function buildSignedMonadMintPassRawTransaction(input: {
  transaction: MonadMintPassTransaction;
  ikaSignature: Uint8Array | Hex;
}) {
  const signatureBytes = typeof input.ikaSignature === "string" ? hexToBytes(input.ikaSignature) : input.ikaSignature;

  if (signatureBytes.length < 64) {
    throw new Error("Ika signature must contain at least r and s.");
  }

  const r = bytesToHex(signatureBytes.slice(0, 32));
  const s = bytesToHex(signatureBytes.slice(32, 64));
  const txHash = getUnsignedMonadTransactionHash(input.transaction);

  const candidateRecoveryIds =
    signatureBytes.length >= 65 ? [normalizeRecoveryId(signatureBytes[64]), 0, 1] : [0, 1];

  for (const yParity of candidateRecoveryIds) {
    const recovered = await recoverAddress({ hash: txHash, signature: { r, s, yParity } });
    if (getAddress(recovered) === getAddress(input.transaction.from)) {
      return serializeTransaction(input.transaction, { r, s, yParity });
    }
  }

  throw new Error("Ika signature did not recover to the configured dWallet minter address.");
}

export async function submitSignedMonadMintPassTransaction(input: {
  rawTransaction: Hex;
  rpcUrl?: string;
}) {
  const response = await fetch(input.rpcUrl ?? monadConfig.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendRawTransaction",
      params: [input.rawTransaction],
    }),
  });
  const payload = (await response.json()) as { result?: Hex; error?: { message?: string } };

  if (!response.ok || payload.error || !payload.result) {
    throw new Error(payload.error?.message ?? "Monad RPC rejected the signed mintPass transaction.");
  }

  return payload.result;
}

function normalizeRecoveryId(value: number) {
  if (value === 27 || value === 28) return value - 27;
  if (value === 0 || value === 1) return value;
  return value % 2;
}
