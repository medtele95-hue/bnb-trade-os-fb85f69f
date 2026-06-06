import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { isSameSymbol, normalizeSymbol } from "@/lib/symbol";

function fmt(v: any, digits = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(digits) : "—";
  return String(v);
}

export function BtcScalpingPanel() {
  const { rows: decRows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: sigRows } = useLiveTable<any>("strategy_signals", { limit: 50 });

  const d = decRows[0];
  const activeSymbol = d?.symbol ?? null;
  const isGold = activeSymbol ? isSameSymbol(activeSymbol, "GOLD") : false;
  const isEur = activeSymbol ? isSameSymbol(activeSymbol, "EURUSD") : false;
  const isBtc = activeSymbol ? isSameSymbol(activeSymbol, "BTCUSD") : false;

  // Do not render on GOLD or EUR
  if (isGold || isEur) return null;

  const rp = (d?.raw_payload ?? {}) as any;
  const inner = (rp?.raw_payload ?? {}) as any;
  const sig = sigRows.find((r: any) => r.strategy === "BTC_SCALPING_AGENT");
  const sigRp = (sig?.raw_payload ?? {}) as any;

  const b =
    rp?.btc_scalping_agent ??
    inner?.btc_scalping_agent ??
    rp?.btc_scalper ??
    sigRp?.btc_scalping_agent ??
    sigRp ??
    null;

  const hasPayload = !!(b && Object.keys(b).length > 0) || !!sig;

  const decision = String(b?.decision ?? sig?.signal ?? "WAIT").toUpperCase();
  const reason = b?.reason ?? sig?.reason ?? sig?.blocked_reason ?? null;
  const confidence = b?.confidence ?? sig?.confidence ?? sigRp?.confidence;
  const trigger = b?.trigger_type ?? b?.trigger ?? sigRp?.trigger_type ?? null;
  const entry = b?.entry ?? sigRp?.entry;
  const sl = b?.sl ?? sigRp?.sl;
  const tp = b?.tp ?? sigRp?.tp;
  const spread = b?.spread ?? sigRp?.spread;
  const cooldown = b?.cooldown ?? b?.cooldown_remaining ?? sigRp?.cooldown;
  const tradesToday = b?.trades_today ?? sigRp?.trades_today;

  const demoGate = String(
    rp?.demo_gate ?? inner?.demo_gate ?? rp?.DEMO_GATE ?? inner?.DEMO_GATE ?? "",
  ).toUpperCase();
  const demoGatePass = demoGate === "PASS";

  let statusText = "";
  let statusTone: "green" | "orange" | "red" | "yellow" | "gray" = "gray";
  if (!isBtc) {
    statusText = `BTC-ONLY · ACTIVE SYM = ${normalizeSymbol(activeSymbol) || "—"}`;
    statusTone = "gray";
  } else if (decision === "WAIT" || decision === "SKIP" || decision === "SKIPPED") {
    statusText = "WAITING FOR BTC SCALP TRIGGER";
    statusTone = "gray";
  } else if (decision === "BLOCK" || decision === "BLOCKED") {
    statusText = `NO BTC DEMO ENTRY — ${reason ?? "BLOCKED"}`;
    statusTone = "red";
  } else if (decision === "BUY" || decision === "SELL") {
    if (demoGatePass) {
      statusText = `BTC ${decision} — DEMO GATE PASS`;
      statusTone = "green";
    } else {
      statusText = "EXECUTABLE BTC SCALP SIGNAL — WAITING FINAL DEMO GATE";
      statusTone = "orange";
    }
  } else {
    statusText = `STATE: ${decision}`;
    statusTone = "gray";
  }

  return (
    <Panel
      title="BTC SCALPING AGENT"
      right={<Badge value="READ-ONLY · BTC ONLY" tone="gray" />}
    >
      <div className="space-y-2">
        <div className="border border-black/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider opacity-70">Status</span>
            <Badge value={statusText} tone={statusTone} />
          </div>
          {!hasPayload && isBtc && (
            <div className="mt-1 text-[10px] italic opacity-80">
              Waiting for BTC_SCALPING_AGENT backend payload
            </div>
          )}
        </div>

        <div className="border border-dashed border-black/30 p-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
          <div>STRATEGY: <b>BTC_SCALPING_AGENT</b></div>
          <div>ROLE: <b>ENTRY_STRATEGY</b></div>
          <div>ALLOWED SYMBOLS: <b>BTCUSD / BTCUSD#</b></div>
          <div>LEGACY SCALPING_AGENT: <b>OBSERVER ONLY</b></div>
          <div>LIVE TRADING: <b className="text-loss">BLOCKED</b></div>
          <div>DEMO LOT MAX: <b>0.01</b></div>
        </div>

        {hasPayload && (
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <KV k="Decision" v={<Badge value={decision} tone={
                decision === "BUY" ? "green" : decision === "SELL" ? "red" : decision === "BLOCK" || decision === "BLOCKED" ? "red" : "gray"
              } />} />
              <KV k="Trigger Type" v={String(trigger ?? "—")} />
              <KV k="Confidence" v={confidence != null ? `${confidence}%` : "—"} />
              <KV k="Spread" v={fmt(spread, 2)} />
              <KV k="Cooldown" v={cooldown != null ? String(cooldown) : "—"} />
              <KV k="Trades Today" v={tradesToday != null ? String(tradesToday) : "—"} />
            </div>
            <div>
              <KV k="Entry" v={fmt(entry, 2)} />
              <KV k="SL" v={fmt(sl, 2)} accent="loss" />
              <KV k="TP" v={fmt(tp, 2)} accent="profit" />
              <KV k="Reason" v={reason ? String(reason) : "—"} />
            </div>
          </div>
        )}

        <div className="text-[9px] opacity-60 uppercase tracking-wider">
          Read-only. "TRADE READY" only appears when backend DEMO_GATE = PASS.
        </div>
      </div>
    </Panel>
  );
}
