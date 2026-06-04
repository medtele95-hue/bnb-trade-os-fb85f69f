import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";

function fmt(v: any, digits = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(digits) : "—";
  return String(v);
}

function pct(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(0)}%`;
}

function bool(v: any): string {
  if (v === true) return "YES";
  if (v === false) return "NO";
  return "—";
}

const EXECUTABLE_REV = new Set(["ABS", "REJ"]);
const OBSERVER_REV = new Set(["EXH", "DIV"]);

export function GoldLiquidityHunter() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = (d?.raw_payload ?? {}) as any;
  const inner = (rp?.raw_payload ?? {}) as any;
  const g = (rp?.gold_liquidity_hunter ?? inner?.gold_liquidity_hunter ?? {}) as any;

  const mode = g.mode ?? "LIQUIDITY HUNTER PRO";
  const decision = String(g.decision ?? "WAIT").toUpperCase();
  const reason = g.reason ?? g.block_reason ?? null;
  const blockReason = g.block_reason ?? null;
  const revRaw = String(g.reversal_signal ?? "NONE").toUpperCase();
  const reversal = ["ABS", "REJ", "EXH", "DIV", "NONE"].includes(revRaw) ? revRaw : "NONE";

  // Final demo gate check (only TRADE READY if backend confirms)
  const demoGate = String(
    rp?.demo_gate ?? inner?.demo_gate ?? rp?.DEMO_GATE ?? inner?.DEMO_GATE ?? "",
  ).toUpperCase();
  const demoGatePass = demoGate === "PASS";

  let statusText = "";
  let statusTone: "green" | "orange" | "red" | "yellow" | "gray" = "gray";
  if (OBSERVER_REV.has(reversal)) {
    statusText = "OBSERVER ONLY — NOT EXECUTABLE";
    statusTone = "yellow";
  } else if (decision === "WAIT") {
    statusText = "WAITING FOR BSL/SSL SWEEP + ABS/REJ";
    statusTone = "gray";
  } else if (decision === "BLOCK") {
    statusText = `NO GOLD DEMO ENTRY — ${blockReason ?? reason ?? "BLOCKED"}`;
    statusTone = "red";
  } else if (decision === "BUY" || decision === "SELL") {
    if (demoGatePass) {
      statusText = `GOLD ${decision} — DEMO GATE PASS`;
      statusTone = "green";
    } else {
      statusText = "EXECUTABLE GOLD SIGNAL FOUND — WAITING FINAL DEMO GATE";
      statusTone = "orange";
    }
  } else {
    statusText = `STATE: ${decision}`;
    statusTone = "gray";
  }

  const stars = Number(g.zone_stars ?? 0);
  const starStr = "★".repeat(Math.max(0, Math.min(5, stars))) + "☆".repeat(Math.max(0, 5 - stars));

  return (
    <Panel
      title="GOLD LIQUIDITY HUNTER PRO"
      right={<Badge value="READ-ONLY" tone="gray" />}
    >
      <div className="space-y-2">
        {/* Status banner */}
        <div className="border border-black/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider opacity-70">Status</span>
            <Badge value={statusText} tone={statusTone} />
          </div>
          {reason && decision !== "BLOCK" && (
            <div className="mt-1 text-[10px] opacity-80">REASON: {String(reason)}</div>
          )}
        </div>

        {/* Fixed configuration labels */}
        <div className="border border-dashed border-black/30 p-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
          <div>GOLD MODE: <b>LIQUIDITY HUNTER PRO</b></div>
          <div>GENERIC GOLD STRATEGIES: <b>DISABLED</b></div>
          <div>EXECUTABLE SIGNALS: <b>ABS, REJ</b></div>
          <div>OBSERVER SIGNALS: <b>EXH, DIV</b></div>
          <div>LIVE TRADING: <b className="text-loss">BLOCKED</b></div>
          <div>DEMO LOT MAX: <b>0.01</b></div>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-x-3">
          <div>
            <KV k="Mode" v={String(mode)} />
            <KV k="Decision" v={<Badge value={decision} tone={
              decision === "BUY" ? "green" : decision === "SELL" ? "red" : decision === "BLOCK" ? "red" : "gray"
            } />} />
            <KV k="Reversal" v={<Badge value={reversal} tone={
              EXECUTABLE_REV.has(reversal) ? "green" : OBSERVER_REV.has(reversal) ? "yellow" : "gray"
            } />} />
            <KV k="Active Zone" v={fmt(g.active_zone, 2)} />
            <KV k="Zone Stars" v={<span className="tracking-widest">{starStr}</span>} />
            <KV k="Zone Health" v={pct(g.zone_health_pct ?? g.zone_health)} />
            <KV k="Test Count" v={fmt(g.test_count, 0)} />
            <KV k="Sweep Count" v={fmt(g.sweep_count, 0)} />
            <KV k="Premium/Discount" v={String(g.premium_discount ?? "—")} />
            <KV k="Liquidity Score" v={fmt(g.liquidity_score, 2)} />
            <KV k="Dir. Confirmation" v={String(g.directional_confirmation ?? "—")} />
          </div>
          <div>
            <KV k="Nearest BSL" v={fmt(g.nearest_bsl, 2)} />
            <KV k="Nearest SSL" v={fmt(g.nearest_ssl, 2)} />
            <KV k="Sweep Detected" v={<Badge value={bool(g.sweep_detected)} tone={g.sweep_detected ? "green" : "gray"} />} />
            <KV k="Sweep Side" v={String(g.sweep_side ?? "—").toUpperCase()} />
            <KV k="Entry" v={fmt(g.entry, 2)} />
            <KV k="SL" v={fmt(g.sl, 2)} accent="loss" />
            <KV k="TP" v={fmt(g.tp, 2)} accent="profit" />
            <KV k="RR" v={fmt(g.rr, 2)} />
            <KV k="Delta Proxy" v={fmt(g.delta_proxy, 2)} />
            <KV k="Block Reason" v={String(blockReason ?? "—")} />
          </div>
        </div>

        {/* Warnings */}
        <div className="border border-black/30 p-2">
          <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Warnings</div>
          {Array.isArray(g.warnings) && g.warnings.length > 0 ? (
            <ul className="text-[10px] space-y-0.5">
              {g.warnings.map((w: any, i: number) => (
                <li key={i} className="flex gap-1"><span className="opacity-60">•</span><span>{String(w)}</span></li>
              ))}
            </ul>
          ) : (
            <div className="text-[10px] opacity-60">No active warnings</div>
          )}
        </div>

        <div className="text-[9px] opacity-60 uppercase tracking-wider">
          Read-only. "TRADE READY" only appears when backend DEMO_GATE = PASS.
        </div>
      </div>
    </Panel>
  );
}
