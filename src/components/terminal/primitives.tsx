import * as React from "react";

/* -------------- shared tokens (inline so this file is self-contained) -------------- */
export const T = {
  bg: "#04060c",
  panel: "#0a0e16",
  panel2: "#0c1119",
  head: "#0e131d",
  border: "#192231",
  line: "#161f2e",
  txt: "#c8d2e0",
  dim: "#73829c",
  faint: "#3d4759",
  acc: "#2dd4bf",
  buy: "#16c784",
  sell: "#ea3943",
  warn: "#f0b429",
  bid: "#2f81f7",
};

export type SourceState = "LIVE" | "STALE" | "DEGRADED" | "NO_DATA";

/* -------------- Panel -------------- */
export function Panel({
  title,
  right,
  children,
  className,
  pad = true,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={"flex flex-col " + (className ?? "")}
      style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8 }}
    >
      {title !== undefined && (
        <header
          className="flex items-center justify-between gap-3 px-3 py-2"
          style={{
            background: T.head,
            borderBottom: `1px solid ${T.border}`,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        >
          <h3
            className="text-[10.5px] tracking-[0.18em] uppercase font-semibold"
            style={{ color: T.txt, fontFamily: "Archivo, sans-serif" }}
          >
            {title}
          </h3>
          {right && <div className="flex items-center gap-1.5">{right}</div>}
        </header>
      )}
      <div className={pad ? "p-3" : ""}>{children}</div>
    </section>
  );
}

/* -------------- KV row -------------- */
export function KV({
  label,
  value,
  mono = true,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  mono?: boolean;
  tone?: "buy" | "sell" | "warn" | "dim" | "acc";
  className?: string;
}) {
  const color =
    tone === "buy" ? T.buy :
    tone === "sell" ? T.sell :
    tone === "warn" ? T.warn :
    tone === "acc" ? T.acc :
    tone === "dim" ? T.dim : T.txt;
  return (
    <div
      className={"flex items-baseline justify-between gap-3 py-1 " + (className ?? "")}
      style={{ borderBottom: `1px solid ${T.line}` }}
    >
      <span
        className="text-[10px] uppercase tracking-[0.14em]"
        style={{ color: T.dim, fontFamily: "Archivo, sans-serif" }}
      >
        {label}
      </span>
      <span
        className="text-[12px] tabular-nums"
        style={{
          color,
          fontFamily: mono ? "JetBrains Mono, monospace" : "Archivo, sans-serif",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* -------------- Generic chip / badge -------------- */
export function Chip({
  children,
  tone = "neutral",
  outline = false,
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "buy" | "sell" | "warn" | "acc" | "dim" | "danger";
  outline?: boolean;
  title?: string;
}) {
  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    neutral: { bg: "#111827", fg: T.txt, border: T.border },
    buy: { bg: "rgba(22,199,132,0.10)", fg: T.buy, border: "rgba(22,199,132,0.45)" },
    sell: { bg: "rgba(234,57,67,0.10)", fg: T.sell, border: "rgba(234,57,67,0.45)" },
    warn: { bg: "rgba(240,180,41,0.10)", fg: T.warn, border: "rgba(240,180,41,0.45)" },
    acc: { bg: "rgba(45,212,191,0.10)", fg: T.acc, border: "rgba(45,212,191,0.45)" },
    dim: { bg: "transparent", fg: T.dim, border: T.faint },
    danger: { bg: T.sell, fg: "#fff", border: T.sell },
  };
  const p = palette[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-1.5 py-[2px] text-[9.5px] uppercase tracking-[0.16em] font-semibold"
      style={{
        background: outline ? "transparent" : p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: 3,
        fontFamily: "Archivo, sans-serif",
      }}
    >
      {children}
    </span>
  );
}

/* -------------- Role vs Data-state badges (kept distinct) -------------- */
export function RoleBadge({ children }: { children: React.ReactNode }) {
  return <Chip tone="dim" outline>{children}</Chip>;
}

export function DataStateBadge({ state, ageSec }: { state: SourceState; ageSec?: number | null }) {
  const tone =
    state === "LIVE" ? "buy" :
    state === "STALE" ? "warn" :
    state === "DEGRADED" ? "warn" :
    "danger";
  const label =
    state === "LIVE" ? "LIVE" :
    state === "STALE" ? `STALE${ageSec != null ? " · " + fmtAge(ageSec) : ""}` :
    state === "DEGRADED" ? "DEGRADED" :
    "NO DATA";
  return <Chip tone={tone as any}>{label}</Chip>;
}

export function FreshnessBadge({ ageSec, staleAfter = 60 }: { ageSec: number | null; staleAfter?: number }) {
  if (ageSec == null) return <DataStateBadge state="NO_DATA" />;
  if (ageSec > staleAfter) return <DataStateBadge state="STALE" ageSec={ageSec} />;
  return <DataStateBadge state="LIVE" />;
}

/* -------------- StatePanel — uniform empty/stale/error wrapper -------------- */
export function StatePanel({
  state,
  message,
  hint,
  lastSeen,
  children,
}: {
  state: SourceState;
  message?: string;
  hint?: string;
  lastSeen?: string | null;
  children?: React.ReactNode;
}) {
  if (state === "LIVE") return <>{children}</>;
  const color =
    state === "NO_DATA" ? T.sell :
    state === "DEGRADED" ? T.warn :
    T.warn;
  return (
    <div
      className="flex flex-col gap-1 px-3 py-4 text-[11px]"
      style={{
        background: T.panel2,
        border: `1px dashed ${T.line}`,
        borderRadius: 6,
        color: T.dim,
        fontFamily: "Archivo, sans-serif",
      }}
    >
      <div className="flex items-center gap-2">
        <DataStateBadge state={state} />
        <span className="uppercase tracking-[0.14em]" style={{ color }}>
          {message ?? defaultMsg(state)}
        </span>
      </div>
      {hint && <div className="text-[10.5px]">{hint}</div>}
      {lastSeen && (
        <div className="text-[10px] tabular-nums" style={{ color: T.faint, fontFamily: "JetBrains Mono, monospace" }}>
          LAST SEEN · {lastSeen}
        </div>
      )}
      {children && <div className="mt-2 opacity-60">{children}</div>}
    </div>
  );
}

function defaultMsg(s: SourceState) {
  if (s === "NO_DATA") return "NO DATA — field absent from backend payload";
  if (s === "STALE") return "STALE — last update exceeds freshness window";
  if (s === "DEGRADED") return "DEGRADED — ingest impaired, showing last good snapshot";
  return "";
}

/* -------------- helpers -------------- */
export function fmtAge(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function ageSecFrom(ts: any, now = Date.now()): number | null {
  if (!ts) return null;
  const t = Date.parse(String(ts).replace(" ", "T"));
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 1000));
}

export function fmtNum(v: any, digits = 2): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtMoney(v: any, digits = 2): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(digits)}`;
}

export function useTick(intervalMs = 1000) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    setT(Date.now());
    const i = window.setInterval(() => setT(Date.now()), intervalMs);
    return () => window.clearInterval(i);
  }, [intervalMs]);
  return t;
}
