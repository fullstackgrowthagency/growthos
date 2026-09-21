"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "30", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "90", label: "Last 90 Days" },
] as const;

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") ?? "30";

  return (
    <select
      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("range", e.target.value);
        router.push(`/dashboard?${params.toString()}`);
      }}
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
