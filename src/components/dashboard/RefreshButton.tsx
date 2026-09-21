"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RefreshButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing">("idle");

  async function handleClick() {
    setStatus("syncing");
    try {
      await fetch("/api/sync/trigger", { method: "POST" });
      await pollUntilDone();
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  async function pollUntilDone() {
    for (let i = 0; i < 20; i++) {
      const res = await fetch("/api/sync/status");
      const data = (await res.json()) as { inProgress: boolean };
      if (!data.inProgress) return;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={status === "syncing"}>
      {status === "syncing" ? "Refreshing…" : "Refresh Now"}
    </Button>
  );
}
