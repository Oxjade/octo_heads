import type { CrossChainProof, SuiPaymentResult } from "@/lib/ink/types";

export type StoredMint = SuiPaymentResult & {
  name: string;
  metadataUri: string;
  proof?: CrossChainProof;
};

const STORAGE_KEY = "ink-crossmint:mints";

export function loadStoredMints(): StoredMint[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredMint[];
  } catch {
    return [];
  }
}

export function saveStoredMint(mint: StoredMint) {
  if (typeof window === "undefined") return;
  const existing = loadStoredMints();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([mint, ...existing].slice(0, 20)));
}

export function clearStoredMints() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
