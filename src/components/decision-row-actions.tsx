"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FlaskConical, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DecisionRowActions({ id, isMock }: { id: string; isMock: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(method: "PATCH" | "DELETE", body: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/researcher/decisions", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Request failed.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex gap-1">
      <Button size="icon" variant="ghost" title={isMock ? "Mark as real data" : "Mark as mock data"} disabled={busy} onClick={() => call("PATCH", { id, isMock: !isMock })}>
        {isMock ? <Undo2 /> : <FlaskConical />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Delete decision"
        disabled={busy}
        onClick={() => {
          if (confirm("Delete this decision permanently?")) call("DELETE", { id });
        }}
      >
        <Trash2 />
      </Button>
    </span>
  );
}
