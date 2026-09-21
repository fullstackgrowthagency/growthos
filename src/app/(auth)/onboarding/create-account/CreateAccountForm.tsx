"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function CreateAccountForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const agencyId = searchParams.get("agencyId") ?? "";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, email, name: name || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Something went wrong");
      }
      await signIn("email", { email, redirect: false, callbackUrl: "/dashboard" });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!agencyId) {
    return (
      <Card className="w-full max-w-sm p-8 text-sm text-muted-foreground">
        Missing agency context. Start from{" "}
        <a href="/api/connect/install" className="underline">
          the install flow
        </a>
        .
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm p-8">
      <h1 className="text-xl font-semibold">Welcome to GrowthOS</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your HighLevel agency is connected. Create the owner account to finish setup.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="email"
          required
          placeholder="you@agency.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
