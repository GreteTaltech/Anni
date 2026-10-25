"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Search, BookOpen, ClipboardList, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/", label: "Find a substitute", icon: Search },
  { href: "/rules", label: "Substitution rules", icon: BookOpen },
  { href: "/log", label: "Decision log", icon: ClipboardList },
  { href: "/researcher", label: "Researcher", icon: Lock },
];

export function SiteHeader() {
  const pathname = usePathname();
  // The menu is "open" only for the path it was opened on, so navigating closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (v: boolean) => setOpenPath(v ? pathname : null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">SA</span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Substitution Assistant</span>
            <span className="text-[11px] text-muted">Anni · Rimi e-commerce</span>
          </span>
          <Badge variant="danger" className="ml-1 hidden sm:inline-flex">
            Research prototype
          </Badge>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(href) ? "bg-accent-soft text-accent" : "text-zinc-600 hover:bg-zinc-100 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <nav className="border-t border-border bg-white px-4 py-2 md:hidden" aria-label="Main mobile">
          <div className="mb-2 px-3 pt-1">
            <Badge variant="danger">Research prototype</Badge>
          </div>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                isActive(href) ? "bg-accent-soft text-accent" : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
