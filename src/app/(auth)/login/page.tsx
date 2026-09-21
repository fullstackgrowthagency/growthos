"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn("email", { email, redirect: false, callbackUrl: "/dashboard" });
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold">GrowthOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your agency dashboard.</p>

        {sent ? (
          <p className="mt-6 text-sm">
            Check <span className="font-medium">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              placeholder="you@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" className="w-full">
              Send sign-in link
            </Button>
          </form>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Not installed on HighLevel yet?{" "}
          <a href="/api/connect/install" className="underline">
            Install GrowthOS
          </a>
        </p>
      </Card>
    </div>
  );
}
