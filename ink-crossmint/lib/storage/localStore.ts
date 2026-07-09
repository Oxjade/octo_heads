import type { CrossChainProof, SuiPaymentResult } from "@/lib/ink/types";

export type StoredMint = SuiPaymentResult & {
  name: string;
  metadataUri: string;
  proof?: CrossChainProof;
};

const STORAGE_KEY = "ink-crossmint:mints";
const INK_USERNAME_KEY = "ink-crossmint:ink-username";
const TELEGRAM_JOINED_KEY = "ink-crossmint:telegram-joined";

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

export function loadInkUsername() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(INK_USERNAME_KEY) ?? "";
}

export function saveInkUsername(username: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INK_USERNAME_KEY, username);
}

export function loadTelegramJoined() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TELEGRAM_JOINED_KEY) === "true";
}

export function saveTelegramJoined(joined: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TELEGRAM_JOINED_KEY, joined ? "true" : "false");
}
