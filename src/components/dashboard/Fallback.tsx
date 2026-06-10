import * as React from "react";

type Tone = "wait" | "stale" | "observe" | "degraded" | "nodata";

const styles: Record<Tone, { fg: string; bg: string; label: string }> = {
  wait:     { fg: "#73829c", bg: "rgba(115,130,156,0.10)", label: "WAITING DATA" },
  stale:    { fg: "#f0b429", bg: "rgba(240,180,41,0.12)",  label: "STALE" },
  observe:  { fg: "#2dd4bf", bg: "rgba(45,212,191,0.10)",  label: "OBSERVE ONLY" },
  degraded: { fg: "#ea3943", bg: "rgba(234,57,67,0.12)",   label: "BACKEND DEGRADED" },
  nodata:   { fg: "#6a7688", bg: "rgba(106,118,136,0.10)", label: "NO DATA" },
};

export function Fallback({
  tone = "wait",
  label,
  block = false,
}: {
  tone?: Tone;
  label?: string;
  block?: boolean;
}) {
  const s = styles[tone];
  const text = label ?? s.label;
  if (block) {
    return (
      <div
        className="border px-3 py-4 text-center text-[10px] uppercase tracking-[0.25em] font-bold"
        style={{ borderColor: s.fg, color: s.fg, background: s.bg }}
      >
        <span className="opacity-70">::</span> {text} <span className="blink">_</span>
      </div>
    );
  }
  return (
    <span
      className="inline-block border px-1.5 py-px text-[10px] font-bold uppercase tracking-wider"
      style={{ borderColor: s.fg, color: s.fg, background: s.bg }}
    >
      {text}
    </span>
  );
}
