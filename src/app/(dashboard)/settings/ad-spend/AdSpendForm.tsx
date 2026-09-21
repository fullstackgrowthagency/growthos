"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function AdSpendForm({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [month, setMonth] = useState(currentMonthValue());
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/ad-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, month, amount: Number(amount) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setAmount("");
      router.refresh();
    } catch {
      setError("Failed to save ad spend. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (locations.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No active sub-accounts yet — connect HighLevel first under Settings → Connections.
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4 sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Client</span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Spend ($)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </Card>
  );
}
