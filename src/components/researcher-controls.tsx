"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ImportForm({ kind, accept }: { kind: "products" | "rules"; accept: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("kind", kind);
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/researcher/import", { method: "POST", body: data });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Import failed.");
      setMessage({ ok: true, text: j.message });
      form.reset();
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <div>
        <Label htmlFor={`file-${kind}`}>File</Label>
        <Input id={`file-${kind}`} name="file" type="file" accept={accept} required className="mt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm" />
      </div>
      <div>
        <Label htmlFor={`name-${kind}`}>Version name (optional)</Label>
        <Input id={`name-${kind}`} name="name" className="mt-1.5" placeholder={kind === "products" ? "e.g. Rimi products 2026-10" : "e.g. Guideline v2"} />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activate" value="true" defaultChecked className="accent-accent" /> Set active
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} Import
        </Button>
      </div>
      {message ? (
        <div className="md:col-span-3">
          <Alert variant={message.ok ? "info" : "error"}>{message.text}</Alert>
        </div>
      ) : null}
    </form>
  );
}

export function ActivateButton({ kind, id }: { kind: "dataset" | "ruleSet"; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/researcher/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
          if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Failed.");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Set active
    </Button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await fetch("/api/researcher/logout", { method: "POST" });
        router.replace("/researcher/login");
        router.refresh();
      }}
    >
      <LogOut /> Log out
    </Button>
  );
}
