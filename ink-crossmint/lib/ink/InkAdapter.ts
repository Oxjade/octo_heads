import { buildSuiPaymentTransaction, extractSuiPaymentReceiptId } from "@/lib/sui/mint";
import { generateMonadProof } from "@/lib/monad/proof";
import { createBrowserDWallet } from "./dwallet";
import { privateKeyToAccount } from "viem/accounts";
import type {
  CrossChainProof,
  CrossChainProofInput,
  DWallet,
  InkAdapter,
  InkUser,
  SuiPaymentInput,
  SuiPaymentResult,
  SuiTransactionSigner,
} from "./types";

export class BrowserInkAdapter implements InkAdapter {
  private user: InkUser | null = null;

  constructor(
    private readonly options: {
      suiAddress?: string;
      monadAddress?: string;
      dwalletPrivateKey?: `0x${string}`;
      signSuiTransaction?: SuiTransactionSigner;
    } = {},
  ) {}

  async connect(): Promise<InkUser> {
    let monadAddress = this.options.monadAddress;

    if (!monadAddress && typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
        monadAddress = accounts[0];
      } catch {
        monadAddress = undefined;
      }
    }

    this.user = {
      id: this.options.suiAddress ?? monadAddress ?? `ink-session-${Date.now().toString(36)}`,
      suiAddress: this.options.suiAddress,
      monadAddress,
      sessionStatus: "active",
      signingMode: "ink-adapter",
    };

    return this.user;
  }

  async disconnect() {
    this.user = { ...this.user, sessionStatus: "disconnected" } as InkUser;
  }

  getUser() {
    return this.user;
  }

  getSuiAddress() {
    return this.user?.suiAddress;
  }

  getMonadAddress() {
    return this.user?.monadAddress;
  }

  async createDWallet(): Promise<DWallet> {
    const dwallet = createBrowserDWallet();

    this.user = {
      ...(this.user ?? {
        id: dwallet.id,
        sessionStatus: "active",
        signingMode: "ink-adapter",
      }),
      monadAddress: dwallet.address,
    };

    return dwallet;
  }

  async signSuiTransaction(transaction: Parameters<SuiTransactionSigner>[0]) {
    if (!this.options.signSuiTransaction) {
      throw new Error("Sui wallet signer is not connected.");
    }

    return this.options.signSuiTransaction(transaction);
  }

  async signMonadMessage(message: string) {
    if (this.options.dwalletPrivateKey) {
      const account = privateKeyToAccount(this.options.dwalletPrivateKey);
      return account.signMessage({ message });
    }

    if (typeof window === "undefined" || !window.ethereum) {
      return `simulated-signature:${message}`;
    }

    const [account] = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    const signature = (await window.ethereum.request({
      method: "personal_sign",
      params: [message, account],
    })) as string;

    this.user = {
      ...(this.user ?? {
        id: account,
        sessionStatus: "active",
        signingMode: "ink-adapter",
      }),
      monadAddress: account,
    };

    return signature;
  }

  async acceptSuiPayment(input: SuiPaymentInput): Promise<SuiPaymentResult> {
    const transaction = buildSuiPaymentTransaction(input);
    const result = (await this.signSuiTransaction(transaction)) as Awaited<ReturnType<SuiTransactionSigner>>;
    const objectId = extractSuiPaymentReceiptId(result);

    return {
      digest: result.digest ?? `local-${Date.now().toString(36)}`,
      objectId,
      timestamp: Date.now(),
    };
  }

  async generateCrossChainProof(input: CrossChainProofInput): Promise<CrossChainProof> {
    return generateMonadProof(input, (message) => this.signMonadMessage(message));
  }
}

export function createInkAdapter(options?: ConstructorParameters<typeof BrowserInkAdapter>[0]) {
  return new BrowserInkAdapter(options);
}
