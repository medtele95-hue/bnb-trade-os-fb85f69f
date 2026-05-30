import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  value,
  tone,
  className,
}: {
  value: React.ReactNode;
  tone?: "green" | "strong-green" | "orange" | "red" | "yellow" | "gray";
  className?: string;
}) {
  const styles: Record<string, string> = {
    "strong-green": "bg-emerald-600 text-white border-emerald-800",
    green: "bg-emerald-200 text-emerald-900 border-emerald-700",
    yellow: "bg-yellow-200 text-yellow-900 border-yellow-700",
    orange: "bg-orange-300 text-orange-950 border-orange-700",
    red: "bg-red-300 text-red-950 border-red-800",
    gray: "bg-neutral-200 text-neutral-700 border-neutral-500",
  };
  return (
    <span
      className={cn(
        "inline-block border px-1.5 py-px text-[10px] font-bold uppercase tracking-wider",
        styles[tone ?? "gray"],
        className,
      )}
    >
      {value}
    </span>
  );
}

export function statusTone(s: string | null | undefined): "green" | "orange" | "red" | "gray" {
  const v = String(s ?? "").toUpperCase();
  if (v === "PASS" || v === "OK" || v === "ACTIVE" || v === "ENABLED" || v === "ALLOW_PAPER_OPEN") return "green";
  if (v === "CAUTION" || v === "GUARDED" || v === "SKIP_ANALYSIS_ONLY") return "orange";
  if (v === "BLOCK" || v === "BLOCKED" || v === "MISMATCH" || v === "DISABLED") return "red";
  return "gray";
}

export function gradeTone(g: string | null | undefined): "strong-green" | "green" | "yellow" | "red" | "gray" {
  const v = String(g ?? "").toUpperCase();
  if (v === "A+") return "strong-green";
  if (v === "A") return "green";
  if (v === "B") return "yellow";
  if (v === "C") return "red";
  return "gray";
}
