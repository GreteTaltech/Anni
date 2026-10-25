import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-accent text-white",
      secondary: "border-transparent bg-zinc-100 text-zinc-700",
      outline: "border-border text-foreground",
      success: "border-transparent bg-emerald-100 text-emerald-800",
      warning: "border-transparent bg-amber-100 text-amber-800",
      danger: "border-transparent bg-accent-soft text-accent",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
