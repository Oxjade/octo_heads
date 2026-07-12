import { suiNetwork } from "./chains";

export type IkaNetwork = "testnet" | "mainnet";

export const ikaRuntimeConfig = {
  network: (process.env.NEXT_PUBLIC_IKA_NETWORK ?? (suiNetwork === "mainnet" ? "mainnet" : "testnet")) as IkaNetwork,
  ikaCoinObjectId: process.env.IKA_COIN_ID ?? process.env.NEXT_PUBLIC_IKA_COIN_OBJECT_ID ?? "",
  suiFeeMist: BigInt(process.env.NEXT_PUBLIC_IKA_SUI_FEE_MIST ?? "10000000"),
  signTimeoutMs: Number(process.env.NEXT_PUBLIC_IKA_SIGN_TIMEOUT_MS ?? 90000),
  dWalletId: process.env.IKA_DWALLET_ID ?? process.env.NEXT_PUBLIC_IKA_DWALLET_ID ?? "",
  dWalletCapId: process.env.IKA_DWALLET_CAP_ID ?? process.env.NEXT_PUBLIC_IKA_DWALLET_CAP_ID ?? "",
  dWalletEvmAddress: process.env.IKA_ETH_ADDRESS ?? process.env.NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS ?? "",
  encryptedUserSecretKeyShareId: process.env.IKA_ENCRYPTED_USER_SECRET_KEY_SHARE_ID ?? "",
  userShareEncryptionKeysBase64: process.env.IKA_USER_SHARE_ENCRYPTION_KEYS_B64 ?? "",
};

export function requireIkaFeeObjects() {
  if (!ikaRuntimeConfig.ikaCoinObjectId) {
    throw new Error("Configure NEXT_PUBLIC_IKA_COIN_OBJECT_ID with an IKA coin object before using Ika MPC signing.");
  }

  return {
    ikaCoinObjectId: ikaRuntimeConfig.ikaCoinObjectId,
    suiFeeMist: ikaRuntimeConfig.suiFeeMist,
  };
}

export function requireIkaMintSigner() {
  requireIkaFeeObjects();

  if (
    !ikaRuntimeConfig.dWalletId ||
    !ikaRuntimeConfig.dWalletCapId ||
    !ikaRuntimeConfig.dWalletEvmAddress ||
    !ikaRuntimeConfig.encryptedUserSecretKeyShareId ||
    !ikaRuntimeConfig.userShareEncryptionKeysBase64
  ) {
    throw new Error(
      "Configure the Ika dWallet, capability, EVM address, encrypted user share, and user share encryption keys before minting on Monad.",
    );
  }

  return {
    dWalletId: ikaRuntimeConfig.dWalletId,
    dWalletCapId: ikaRuntimeConfig.dWalletCapId,
    dWalletEvmAddress: ikaRuntimeConfig.dWalletEvmAddress as `0x${string}`,
    encryptedUserSecretKeyShareId: ikaRuntimeConfig.encryptedUserSecretKeyShareId,
    userShareEncryptionKeysBase64: ikaRuntimeConfig.userShareEncryptionKeysBase64,
  };
}
