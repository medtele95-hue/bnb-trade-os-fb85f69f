import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { isSameSymbol, normalizeSymbol } from "@/lib/symbol";

function fmt(v: any, digits = 5): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(digits) : "—";
  return String(v);
}
function bool(v: any): string {
  if (v === true) return "YES";
  if (v === false) return "NO";
  return "—";
}

export function EurEmaRsiAtrPanel() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = (d?.raw_payload ?? {}) as any;
  const inner = (rp?.raw_payload ?? {}) as any;
  const e = (rp?.eur_ema_rsi_atr ?? inner?.eur_ema_rsi_atr ?? null) as any;

  const symbol = d?.symbol ?? null;
  const isEur = symbol ? isSameSymbol(symbol, "EURUSD") : false;

  const demoGate = String(
    rp?.demo_gate ?? inner?.demo_gate ?? rp?.DEMO_GATE ?? inner?.DEMO_GATE ?? "",
  ).toUpperCase();
  const demoGatePass = demoGate === "PASS" && isEur;

  const missing = !e || Object.keys(e).length === 0;
  const decision = String(e?.decision ?? "WAIT").toUpperCase();
  const blockReason = e?.block_reason ?? null;

  let statusText = "";
  let statusTone: "green" | "orange" | "red" | "yellow" | "gray" = "gray";
  if (missing) {
    statusText = "Waiting for EUR_EMA_RSI_ATR_CROSSOVER backend payload";
    statusTone = "orange";
  } else if (decision === "WAIT") {
    statusText = "WAITING FOR EMA20/EMA50 CROSS + RSI CONFIRMATION";
    statusTone = "gray";
  } else if (decision === "BLOCK") {
    statusText = `NO EUR DEMO ENTRY — ${blockReason ?? "BLOCKED"}`;
    statusTone = "red";
  } else if (decision === "BUY") {
    statusText = demoGatePass
      ? "EUR BUY — DEMO GATE PASS"
      : "EUR BUY SIGNAL FOUND — WAITING FINAL DEMO GATE";
    statusTone = demoGatePass ? "green" : "orange";
  } else if (decision === "SELL") {
    statusText = demoGatePass
      ? "EUR SELL — DEMO GATE PASS"
      : "EUR SELL SIGNAL FOUND — WAITING FINAL DEMO GATE";
    statusTone = demoGatePass ? "green" : "orange";
  } else {
    statusText = `STATE: ${decision}`;
    statusTone = "gray";
  }

  return (
    <Panel
      title="EUR EMA RSI ATR CROSSOVER"
      right={<Badge value="READ-ONLY" tone="gray" />}
    >
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-widest opacity-70">
          ENTRY STRATEGY — EURUSD ONLY
        </div>

        <div className="border border-black/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider opacity-70">Status</span>
            <Badge value={statusText} tone={statusTone} />
          </div>
          <div className="mt-1 text-[10px] opacity-70">
            ACTIVE SYMBOL: <b>{symbol ? normalizeSymbol(symbol) : "—"}</b>
            {!isEur && symbol && (
              <span className="ml-2 text-loss uppercase">
                ⚠ Active symbol is not EURUSD — panel reflects last decision only
              </span>
            )}
          </div>
        </div>

        <div className="border border-dashed border-black/30 p-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
          <div className="col-span-2">EURUSD TRADES ONLY WITH <b>EMA CROSS + RSI + ATR</b></div>
          <div>GENERIC EUR STRATEGIES: <b>DISABLED</b></div>
          <div>LIVE TRADING: <b className="text-loss">BLOCKED</b></div>
          <div>DEMO LOT MAX: <b>0.01</b></div>
          <div>RR TARGET: <b>2.0</b></div>
        </div>

        {missing ? (
          <div className="border border-orange-400 p-2 text-[10px] uppercase tracking-widest text-orange-700">
            Waiting for ai_decisions.raw_payload.eur_ema_rsi_atr
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <KV k="Mode" v={String(e.mode ?? "—")} />
              <KV k="Strategy" v={String(e.strategy ?? "EUR_EMA_RSI_ATR_CROSSOVER")} />
              <KV k="Source" v={String(e.source ?? "—")} />
              <KV k="Decision" v={<Badge value={decision} tone={
                decision === "BUY" ? "green" : decision === "SELL" ? "red" : decision === "BLOCK" ? "red" : "gray"
              } />} />
              <KV k="EMA20" v={fmt(e.ema20 ?? e.ema20_current)} />
              <KV k="EMA50" v={fmt(e.ema50 ?? e.ema50_current)} />
              <KV k="EMA20 Prev" v={fmt(e.ema20_prev ?? e.ema20_previous)} />
              <KV k="EMA50 Prev" v={fmt(e.ema50_prev ?? e.ema50_previous)} />
              <KV k="RSI 14" v={fmt(e.rsi14 ?? e.rsi_14, 2)} />
              <KV k="ATR 14" v={fmt(e.atr14 ?? e.atr_14, 5)} />
            </div>
            <div>
              <KV k="Cross Up" v={<Badge value={bool(e.cross_up)} tone={e.cross_up ? "green" : "gray"} />} />
              <KV k="Cross Down" v={<Badge value={bool(e.cross_down)} tone={e.cross_down ? "red" : "gray"} />} />
              <KV k="Entry" v={fmt(e.entry)} />
              <KV k="SL" v={fmt(e.sl)} accent="loss" />
              <KV k="TP" v={fmt(e.tp)} accent="profit" />
              <KV k="RR" v={fmt(e.rr, 2)} />
              <KV k="Final Lot" v={fmt(e.final_lot ?? e.lot, 2)} />
              <KV k="Block Reason" v={String(blockReason ?? "—")} />
            </div>
          </div>
        )}

        <div className="border border-black/30 p-2">
          <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Warnings</div>
          {Array.isArray(e?.warnings) && e.warnings.length > 0 ? (
            <ul className="text-[10px] space-y-0.5">
              {e.warnings.map((w: any, i: number) => (
                <li key={i} className="flex gap-1"><span className="opacity-60">•</span><span>{String(w)}</span></li>
              ))}
            </ul>
          ) : (
            <div className="text-[10px] opacity-60">No active warnings</div>
          )}
        </div>

        <div className="text-[9px] opacity-60 uppercase tracking-wider">
          Read-only. "TRADE READY" only appears when backend DEMO_GATE = PASS and symbol = EURUSD.
        </div>
      </div>
    </Panel>
  );
}
