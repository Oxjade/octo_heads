import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, stringToBytes } from "viem";
import type { DWallet } from "./types";

export function createBrowserDWallet(): DWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const createdAt = Date.now();

  return {
    id: keccak256(stringToBytes(`${account.address}:${createdAt}`)),
    address: account.address,
    privateKey,
    createdAt,
    network: "monad",
    custody: "browser-local-fallback",
    coordinator: "ika",
  };
}
