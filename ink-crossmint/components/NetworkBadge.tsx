import { Activity, CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "./ui";

export function NetworkBadge({
  label,
  status = "ready",
}: {
  label: string;
  status?: "ready" | "pending" | "warning";
}) {
  const Icon = status === "warning" ? CircleAlert : status === "pending" ? Activity : CheckCircle2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        status === "ready" && "border-success/35 bg-success/10 text-success",
        status === "pending" && "border-warning/35 bg-warning/10 text-warning",
        status === "warning" && "border-danger/35 bg-danger/10 text-danger",
      )}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}
