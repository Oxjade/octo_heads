import { CheckCircle2, Circle, CircleAlert, Loader2 } from "lucide-react";
import { collectionConfig } from "@/config/collection";
import { cn, Panel } from "./ui";

export type TimelineState = "pending" | "active" | "completed" | "failed";
export type TimelineStep = { label: string; state: TimelineState; error?: string };

const iconMap = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle2,
  failed: CircleAlert,
};

export const defaultTimelineLabels = [
  "Preparing Ink session",
  "Building Sui payment transaction",
  "Waiting for signature",
  `Paying ${collectionConfig.mintPrice} SUI`,
  "Confirming Sui payment receipt",
  "Requesting Ika presign",
  "MPC signing mintPass",
  "Submitting Monad NFT mint",
  "Saving proof state",
  "Complete",
];

export function TransactionTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold text-ink">Transaction timeline</h2>
      <div className="mt-5 space-y-3">
        {steps.map((step) => {
          const Icon = iconMap[step.state];
          return (
            <div key={step.label} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border",
                  step.state === "completed" && "border-success/40 text-success",
                  step.state === "active" && "border-primary/50 text-primary",
                  step.state === "failed" && "border-danger/40 text-danger",
                  step.state === "pending" && "border-line text-muted",
                )}
              >
                <Icon size={15} className={step.state === "active" ? "animate-spin" : ""} />
              </span>
              <div>
                <p className={cn("text-sm font-medium", step.state === "pending" ? "text-muted" : "text-ink")}>{step.label}</p>
                {step.error && <p className="mt-1 text-sm text-danger">{step.error}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
