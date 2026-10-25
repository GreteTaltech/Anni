"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(({ className, children, title, description, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white shadow-xl focus:outline-none",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description> : null}
        </div>
        <DialogPrimitive.Close className="rounded-md p-1 text-muted hover:bg-zinc-100 hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </div>
      <div className="overflow-y-auto px-5 py-4">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export { Dialog, DialogTrigger, DialogClose, DialogContent };
