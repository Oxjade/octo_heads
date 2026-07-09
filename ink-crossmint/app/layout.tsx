import type { Metadata } from "next";
import Link from "next/link";
import { Cpu, ShieldCheck } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Ink CrossMint",
  description: "Pay with Sui. NFT lives on Monad. Coordinated by Ink + Ika.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen">
            <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
              <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3">
                <Link href="/" className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg border border-primary/50 bg-primary/15 text-primary">
                    <ShieldCheck size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">Ink CrossMint</span>
                    <span className="block text-xs text-muted">Sui payment · Monad NFT</span>
                  </span>
                </Link>
                <a
                  href="https://useink.xyz"
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary/70"
                >
                  <Cpu size={16} />
                  Ink
                </a>
              </div>
            </header>
            {children}
            <footer className="border-t border-line">
              <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
                <p>Paid on Sui. NFT lives on Monad. Coordinated by Ink + Ika.</p>
                <div className="flex items-center gap-3">
                  <a href="https://useink.xyz" className="hover:text-ink">useink.xyz</a>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
