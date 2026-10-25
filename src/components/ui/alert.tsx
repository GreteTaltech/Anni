import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Alert({ variant = "info", title, children, className }: { variant?: "info" | "error" | "warning"; title?: string; children?: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  }[variant];
  const Icon = variant === "info" ? Info : AlertTriangle;
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-4 text-sm", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title ? "mt-1" : undefined)}>{children}</div> : null}
      </div>
    </div>
  );
}
