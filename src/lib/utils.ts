import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Wall-clock milliseconds; kept out of components so the purity lint rule stays quiet. */
export function nowMs(): number {
  return Date.now();
}
