import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDashboardStatusPayload } from "./DemoCenter";

type QuantFields = {
  enabled: any;
  strategy: any;
  signal: any;
  score: any;
  slope: any;
  r2: any;
  z: any;
  mean: any;
  stdev: any;
  reason: any;
  attempted: any;
  confirmed: any;
  failed: any;
  pnl: any;
  win_rate: any;
  has_any: boolean;
  top_down_decision: any;
  backend_decision: any;
};

export function useQuantData(): QuantFields {
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 50 });
  const ds = useDashboardStatusPayload();
  const d = dec[0] ?? {};
  const rp = (d.raw_payload ?? {}) as any;
  const inner = (rp.raw_payload ?? {}) as any;
  const latest = (rp.latest_decision ?? ds?.latest_decision ?? {}) as any;
  // Also look at latest trade raw_payload that mentions quant
  const tradeRp = (() => {
    for (const t of trades) {
      const r = (t.raw_payload ?? {}) as any;
      const ri = (r.raw_payload ?? {}) as any;
      if (
        r.quant_signal != null || ri.quant_signal != null ||
        r.quant_score != null || ri.quant_score != null ||
        String(t.strategy ?? r.strategy ?? "").toUpperCase() === "QUANT_STATISTICAL_PULLBACK"
      ) {
        return { ...ri, ...r };
      }
    }
    return {};
  })();

  const merged = { ...ds, ...tradeRp, ...inner, ...rp, ...latest } as any;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = merged?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const fields: QuantFields = {
    enabled: pick("quant_strategy_enabled"),
    strategy: pick("strategy"),
    signal: pick("quant_signal"),
    score: pick("quant_score"),
    slope: pick("quant_slope"),
    r2: pick("quant_r2"),
    z: pick("quant_z_score"),
    mean: pick("quant_mean"),
    stdev: pick("quant_stdev"),
    reason: pick("quant_reason"),
    attempted: pick("quant_orders_attempted"),
    confirmed: pick("quant_orders_confirmed"),
    failed: pick("quant_orders_failed"),
    pnl: pick("quant_pnl"),
    win_rate: pick("quant_win_rate"),
    top_down_decision: pick("top_down_decision"),
    backend_decision: pick("decision") ?? d.decision,
    has_any: false,
  };
  fields.has_any =
    fields.enabled != null ||
    fields.signal != null ||
    fields.score != null ||
    fields.r2 != null ||
    fields.z != null ||
    fields.reason != null ||
    String(fields.strategy ?? "").toUpperCase() === "QUANT_STATISTICAL_PULLBACK";
  return fields;
}

export function signalTone(sig: any): "green" | "orange" | "red" | "gray" {
  const v = String(sig ?? "").toUpperCase();
  if (v === "PASS" || v === "CONFIRM_BUY" || v === "CONFIRM_SELL") return "green";
  if (v === "WAIT" || v === "NO_EDGE") return "orange";
  if (v === "FAIL" || v === "CONFLICT") return "red";
  return "gray";
}

function num(v: any, digits = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(digits);
}

export function QuantStrategyPanel() {
  const q = useQuantData();
  if (!q.has_any) {
    return (
      <Panel title="QUANT STATISTICAL PULLBACK" right="ENTRY_STRATEGY">
        <div className="border border-dashed border-black/40 p-3 text-[11px] italic opacity-70 text-center">
          Waiting for Quant data
        </div>
      </Panel>
    );
  }

  const enabled = q.enabled === true || String(q.enabled).toUpperCase() === "TRUE" || String(q.enabled).toUpperCase() === "ENABLED";
  const sigStr = String(q.signal ?? "—").toUpperCase();
  const tone = signalTone(q.signal);

  const topDown = String(q.top_down_decision ?? "").toUpperCase();
  const backendDec = String(q.backend_decision ?? "").toUpperCase();
  const waitingTopDown =
    (sigStr === "CONFIRM_BUY" || sigStr === "CONFIRM_SELL") &&
    (topDown === "WAIT_FOR_CONFIRMATION" || topDown === "AVOID") &&
    backendDec !== "ALLOW_DEMO";

  return (
    <Panel title="QUANT STATISTICAL PULLBACK" right="ENTRY_STRATEGY">
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-black p-1.5">
          <div className="text-[9px] uppercase opacity-70">Status</div>
          <Badge value={enabled ? "ENABLED" : "DISABLED"} tone={enabled ? "green" : "gray"} />
        </div>
        <div className="border border-black p-1.5">
          <div className="text-[9px] uppercase opacity-70">Signal</div>
          <Badge value={sigStr} tone={tone} />
        </div>
        <div className="border border-black p-1.5">
          <div className="text-[9px] uppercase opacity-70">Score</div>
          <div className="pixel text-[16px]">{q.score != null ? `${q.score}/100` : "—"}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3">
        <KV k="Trend Slope" v={num(q.slope, 4)} />
        <KV k="R²" v={num(q.r2, 2)} />
        <KV k="Z-Score" v={num(q.z, 2)} />
        <KV k="Mean" v={num(q.mean, 4)} />
        <KV k="StDev" v={num(q.stdev, 4)} />
        <KV k="Role" v="ENTRY_STRATEGY" />
      </div>

      <div className="mt-2 border-t border-black pt-1.5 grid grid-cols-3 gap-x-3">
        <KV k="Orders Attempted" v={q.attempted ?? "—"} />
        <KV k="Confirmed" v={q.confirmed ?? "—"} />
        <KV k="Failed" v={q.failed ?? "—"} />
        <KV
          k="Quant PnL"
          v={q.pnl != null ? `${Number(q.pnl) >= 0 ? "+" : ""}$${Number(q.pnl).toFixed(2)}` : "—"}
          accent={q.pnl != null ? (Number(q.pnl) >= 0 ? "profit" : "loss") : undefined}
        />
        <KV k="Win Rate" v={q.win_rate != null ? `${q.win_rate}%` : "—"} />
      </div>

      {q.reason && (
        <div className="mt-2 text-[10px] opacity-80 italic">
          <b>REASON:</b> "{String(q.reason)}"
        </div>
      )}

      {waitingTopDown && (
        <div className="mt-2 border border-dashed border-black/70 px-2 py-1 text-[10px] uppercase tracking-widest text-center">
          ⚠ QUANT SIGNAL FOUND — WAITING TOP-DOWN CONFIRMATION
        </div>
      )}
    </Panel>
  );
}

// Single-line ribbon to place above the main chart
export function ConfirmationRibbon() {
  const ds = useDashboardStatusPayload();
  const q = useQuantData();
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = dec[0] ?? {};
  const rp = (d.raw_payload ?? {}) as any;
  const inner = (rp.raw_payload ?? {}) as any;
  const m = { ...ds, ...rp, ...inner } as any;

  const v = (...ks: string[]) => {
    for (const k of ks) {
      const val = m[k];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return null;
  };

  const cell = (label: string, val: any, tone?: "green" | "orange" | "red" | "gray") => (
    <div className="flex items-center gap-1 px-2 border-r border-black/40 last:border-r-0 whitespace-nowrap">
      <span className="opacity-60">{label}</span>
      {tone ? (
        <Badge value={String(val ?? "—")} tone={tone} />
      ) : (
        <b>{val ?? "—"}</b>
      )}
    </div>
  );

  const topDown = v("top_down_decision");
  const topDownTone = (() => {
    const s = String(topDown ?? "").toUpperCase();
    if (s === "ALLOW_DEMO") return "green" as const;
    if (s === "WAIT_FOR_CONFIRMATION") return "orange" as const;
    if (s === "AVOID") return "red" as const;
    return "gray" as const;
  })();

  return (
    <div className="border border-black bg-secondary text-[10px] uppercase tracking-widest flex flex-wrap items-center py-1">
      {cell("H4", v("h4_bias", "htf_bias", "h4_state"))}
      {cell("H1", v("h1_bias", "h1_state"))}
      {cell("M15", v("m15_status", "m15"))}
      {cell("M1", v("m1_entry_confirmation", "m1_trigger_status", "m1"))}
      {cell("SMC", v("smc_confluence_status", "smc"))}
      {cell("MTFA", v("mtfa_status", "mtfa"))}
      {cell("TOP-DOWN", String(topDown ?? "—").toUpperCase(), topDownTone)}
      {cell(
        "QUANT",
        q.signal != null
          ? `${String(q.signal).toUpperCase()}${q.score != null ? ` ${q.score}/100` : ""}`
          : "—",
        signalTone(q.signal),
      )}
      {cell("R²", q.r2 != null ? Number(q.r2).toFixed(2) : "—")}
      {cell("Z", q.z != null ? `${Number(q.z) >= 0 ? "+" : ""}${Number(q.z).toFixed(2)}` : "—")}
      {cell("RR", v("rr", "reward_risk"))}
      {cell("SPREAD", v("spread"))}
      {cell("LOT", v("final_capped_lot", "demo_capped_lot", "lot_size"))}
    </div>
  );
}

// Floating chart label overlay (positioned via parent relative wrapper)
export function QuantChartLabel() {
  const q = useQuantData();
  if (!q.has_any || q.signal == null) return null;
  const sig = String(q.signal).toUpperCase();
  let label = "";
  let tone: "green" | "orange" | "red" | "gray" = "gray";
  if (sig === "CONFIRM_BUY") { label = "QUANT BUY PULLBACK ✓"; tone = "green"; }
  else if (sig === "CONFIRM_SELL") { label = "QUANT SELL PULLBACK ✓"; tone = "green"; }
  else if (sig === "WAIT") { label = "QUANT WAIT"; tone = "orange"; }
  else if (sig === "NO_EDGE") { label = "QUANT NO EDGE"; tone = "orange"; }
  else if (sig === "CONFLICT") { label = "QUANT CONFLICT ✕"; tone = "red"; }
  else label = `QUANT ${sig}`;

  return (
    <div className="absolute top-1 right-1 z-10 flex flex-col items-end gap-0.5 pointer-events-none">
      <Badge value={label} tone={tone} />
      <div className="text-[9px] font-mono bg-background/90 border border-black px-1 py-px">
        R² {q.r2 != null ? Number(q.r2).toFixed(2) : "—"}
        {"  "}Z {q.z != null ? `${Number(q.z) >= 0 ? "+" : ""}${Number(q.z).toFixed(2)}` : "—"}
        {"  "}Score {q.score != null ? `${q.score}/100` : "—"}
      </div>
    </div>
  );
}
