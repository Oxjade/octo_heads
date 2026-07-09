"use client";

import { CheckCircle2, X } from "lucide-react";
import type { StoredMint } from "@/lib/storage/localStore";
import { Button, shortAddress } from "./ui";

export function MintSuccessModal({ mint, onClose }: { mint?: StoredMint; onClose: () => void }) {
  if (!mint) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 size={18} />
              <span className="text-sm font-semibold">Payment complete</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-ink">{mint.name}</h2>
          </div>
          <button aria-label="Close modal" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Sui payment receipt</dt>
            <dd className="break-words font-semibold text-ink">{mint.objectId}</dd>
          </div>
          <div>
            <dt className="text-muted">Monad NFT proof hash</dt>
            <dd className="font-semibold text-ink">{shortAddress(mint.proof?.proofHash, 8)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onClose}>Stay here</Button>
        </div>
      </div>
    </div>
  );
}
