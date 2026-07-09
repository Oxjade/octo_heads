"use client";

import "@mysten/dapp-kit/dist/index.css";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { suiNetwork, suiRpcUrl } from "@/config/chains";

const { networkConfig } = createNetworkConfig({
  [suiNetwork === "localnet" ? "testnet" : suiNetwork]: { url: suiRpcUrl },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={suiNetwork === "localnet" ? "testnet" : suiNetwork}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
