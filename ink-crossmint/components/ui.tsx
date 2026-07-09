import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address?: string, chars = 4) {
  if (!address) return "Not connected";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface p-5", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={buttonClassName({ variant, className })}
      {...props}
    />
  );
}

export function buttonClassName({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
} = {}) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
    variant === "primary" && "bg-primary text-white hover:bg-primary-strong",
    variant === "secondary" && "border border-line bg-surface-2 text-ink hover:border-primary/70",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
    className,
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-line bg-bg/45 p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div
        className={cn(
          "mt-2 break-words text-sm font-semibold text-ink",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
    </div>
  );
}
