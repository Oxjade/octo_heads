import type { Metadata } from "next";
import Link from "next/link";
import { Cpu } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";

function toAbsoluteUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

const appUrl = toAbsoluteUrl(
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    // Vercel sets different env vars depending on whether you're on a custom domain
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.NEXT_PUBLIC_DEPLOY_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    // sensible fallback for this deployment
    "octo.useink.xyz",
);

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Ink CrossMint",
  description: "Pay with Sui. NFT lives on Monad. Coordinated by Ink + Ika.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/ink-octo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Ink CrossMint",
    description: "Pay on Sui. Mint on Monad.",
    url: "/",
    siteName: "Ink CrossMint",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Ink CrossMint",
      },
    ],
    type: "website",
  },
  // Important for link previews on custom domains:
  // - metadataBase must be the real deployed origin
  // - og:image must be reachable from that origin
  // - og:url must be a fully-qualified URL in practice; `metadataBase` usually covers that

  twitter: {
    card: "summary_large_image",
    title: "Ink CrossMint",
    description: "Pay on Sui. Mint on Monad.",
    images: ["/og-image.png"],
  },
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
                  <span>
                    <span className="block text-sm font-semibold text-ink">Ink CrossMint</span>
                    <span className="block text-xs text-muted">Sui payment · Monad NFT</span>
                  </span>
                </Link>
                <a
                  href="https://octo.useink.xyz"
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
                  <a href="https://octo.useink.xyz" className="hover:text-ink">octo.useink.xyz</a>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
