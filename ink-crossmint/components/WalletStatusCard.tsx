"use client";

import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Wallet } from "lucide-react";
import { Panel, Stat, shortAddress } from "./ui";
import { NetworkBadge } from "./NetworkBadge";

export function WalletStatusCard() {
  const account = useCurrentAccount();

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Wallet size={16} />
            Wallet connection
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">Connect your Sui wallet to pay. The NFT mint target is Monad.</p>
        </div>
        <ConnectButton connectText="Connect with Ink" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Sui Wallet" value={shortAddress(account?.address)} />
        <Stat label="Connection" value={account ? "Connected" : "Not connected"} tone={account ? "success" : "warning"} />
      </div>
      <div className="mt-4">
        <NetworkBadge label={account ? "Ready to mint" : "Connect wallet"} status={account ? "ready" : "pending"} />
      </div>
    </Panel>
  );
}
