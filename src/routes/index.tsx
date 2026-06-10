import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, KV } from "@/components/dashboard/Panel";
import { CandleChart } from "@/components/dashboard/CandleChart";
import { Waiting } from "@/components/dashboard/Waiting";
import { Fallback } from "@/components/dashboard/Fallback";
import { SmcMap } from "@/components/dashboard/SmcMap";
import { SafetyGuard } from "@/components/dashboard/SafetyGuard";
import { BigSetupDetector } from "@/components/dashboard/BigSetupDetector";
import { StrategyModules } from "@/components/dashboard/StrategyModules";
import { PaperReport } from "@/components/dashboard/PaperReport";
import { Badge, gradeTone, statusTone } from "@/components/dashboard/Badges";
import {
  DemoModeBanner, DemoPilotStatus, DemoGateChecklist, KellyDemoPanel,
  TimeEnginePanel, SmcMtfaPanel, TradeJournalTabs, DemoReport, DemoAlerts, MissingFieldsPanel,
  useBackendTime, useDashboardStatusPayload,
} from "@/components/dashboard/DemoCenter";
import {
  QuantStrategyPanel, QuantProStrategyPanel, ConfirmationRibbon,
  QuantChartLabel, StrategyCountCard,
} from "@/components/dashboard/QuantStrategy";
import { WspChartWorkspace } from "@/components/dashboard/WspIntelligence";
import { TimeframeHierarchyPanel } from "@/components/dashboard/TimeframeHierarchy";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { LiveSyncDebugPanel } from "@/components/dashboard/LiveSyncDebugPanel";
import { HermesAuditPanel } from "@/components/dashboard/HermesAuditPanel";
import { GoldLiquidityHunter } from "@/components/dashboard/GoldLiquidityHunter";
import { GoldOrderFlowCvdVwapPanel } from "@/components/dashboard/GoldOrderFlowCvdVwap";
import { OrderFlowReaderPanel } from "@/components/dashboard/OrderFlowReader";
import { EurEmaRsiAtrPanel } from "@/components/dashboard/EurEmaRsiAtrPanel";
import { BtcScalpingPanel } from "@/components/dashboard/BtcScalpingPanel";
import { QuickExitManager } from "@/components/dashboard/QuickExitManager";
import { StrategyManagerPanel } from "@/components/dashboard/StrategyManagerPanel";
import { SimoAtmBreakoutPanel } from "@/components/dashboard/SimoAtmBreakoutPanel";
import { ConfluenceEnginePanel } from "@/components/dashboard/ConfluenceEnginePanel";
import { GeometryEnginePanel } from "@/components/dashboard/GeometryEnginePanel";
import { BackendHealthPanel } from "@/components/dashboard/BackendHealthPanel";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { normalizeSymbol, isSameSymbol } from "@/lib/symbol";

export const Route = createFileRoute("/")({ component: Dashboard });

/* ============================================================================
 * Shared hooks
 * ========================================================================== */

function useTickingNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);
  return now;
}

function useHeartbeatAge() {
  const ds = useDashboardStatusPayload();
  const hb = (ds as any).utc_time ?? (ds as any).updated_at ?? (ds as any).last_heartbeat ?? null;
  const hbDate = hb ? new Date(String(hb).replace(" ", "T")) : null;
  const now = useTickingNow();
  const ageSec = hbDate && !isNaN(hbDate.getTime())
    ? Math.max(0, Math.floor((now - hbDate.getTime()) / 1000))
    : null;
  return { ageSec, hb, ds };
}


/* ============================================================================
 * TOP BAR
 * ========================================================================== */

type SymbolKey = "BTC" | "GOLD" | "EUR" | "SIMO_ATM";
const SYMBOL_MAP: Record<SymbolKey, string> = {
  BTC: "BTCUSD",
  GOLD: "XAUUSD",
  EUR: "EURUSD",
  SIMO_ATM: "US100",
};

function useMarketAge(sym: string) {
  const { rows } = useLiveTable<any>("market_states", {
    limit: 1,
    filter: { column: "symbol", value: sym },
  });
  const now = useTickingNow();
  const m = rows[0] ?? {};
  const stamp = m.updated_at ?? m.created_at ?? m.ts ?? null;
  const ageSec = stamp
    ? Math.max(0, Math.floor((now - Date.parse(String(stamp).replace(" ", "T"))) / 1000))
    : null;
  return { m, ageSec, stale: ageSec != null && ageSec > 60 };
}

function TopBar({ symbol, onSymbol }: { symbol: SymbolKey; onSymbol: (s: SymbolKey) => void }) {
  const ds: any = useDashboardStatusPayload();
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const s = snaps[0] ?? {};
  const { m, stale: mStale } = useMarketAge(SYMBOL_MAP[symbol]);
  const h = useBackendHealth();
  const stale = mStale || h.verdict !== "ONLINE";
  const price = m.price != null ? Number(m.price) : null;
  const change = m.change_pct ?? m.change ?? null;
  const spread = m.spread ?? ds.spread ?? null;
  const vwap = m.vwap ?? ds.vwap ?? null;
  const hi = m.high ?? null;
  const lo = m.low ?? null;
  const equity = s.equity != null ? Number(s.equity) : null;
  const pnl = s.daily_pnl != null ? Number(s.daily_pnl) : null;

  const dimStyle = stale ? { opacity: 0.55 } : undefined;
  const staleTag = stale ? (
    <span className="ml-1 px-1 text-[8px] uppercase tracking-widest border" style={{ borderColor: "var(--hx-warn)", color: "var(--hx-warn)" }}>STALE</span>
  ) : null;

  return (
    <header
      className="border-b"
      style={{ background: "var(--hx-panel)", borderColor: "var(--hx-border)" }}
    >
      <div className="flex items-stretch gap-0">
        {/* Brand */}
        <div
          className="px-4 py-2 border-r flex flex-col justify-center"
          style={{ borderColor: "var(--hx-border)", minWidth: 220 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block hx-pulse"
              style={{ width: 8, height: 8, background: "var(--hx-acc)", boxShadow: "0 0 10px var(--hx-acc)" }}
            />
            <div className="text-[18px] font-black tracking-tight leading-none" style={{ fontFamily: "Archivo" }}>
              HERMES
              <span style={{ color: "var(--hx-dim)" }}> · TERMINAL</span>
            </div>
          </div>
          <div className="text-[9px] uppercase tracking-[0.25em] mt-1" style={{ color: "var(--hx-dim)" }}>
            MT5 × AI · DEMO PILOT · READ-ONLY
          </div>
        </div>

        {/* Symbol tabs */}
        <div className="flex border-r" style={{ borderColor: "var(--hx-border)" }}>
          {(Object.keys(SYMBOL_MAP) as SymbolKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onSymbol(k)}
              className="px-4 py-2 text-[11px] uppercase tracking-widest border-r"
              data-active={symbol === k}
              style={{
                borderColor: "var(--hx-border)",
                background: symbol === k ? "var(--hx-head)" : "transparent",
                color: symbol === k ? "var(--hx-acc)" : "var(--hx-dim)",
                boxShadow: symbol === k ? "inset 0 -2px 0 var(--hx-acc)" : "none",
                fontWeight: 700,
              }}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Price + change */}
        <div className="px-4 py-2 border-r flex flex-col justify-center" style={{ borderColor: "var(--hx-border)", minWidth: 200 }}>
          <div className="text-[9px] uppercase tracking-widest flex items-center" style={{ color: "var(--hx-dim)" }}>
            {SYMBOL_MAP[symbol]}{staleTag}
          </div>
          <div className="pixel text-[22px] leading-none" style={{ color: "var(--hx-txt)", ...dimStyle }}>
            {price != null ? price.toLocaleString("en-US", { maximumFractionDigits: 5 }) : "—"}
          </div>
          <div
            className="pixel text-[11px]"
            style={{ color: change == null ? "var(--hx-dim)" : Number(change) >= 0 ? "var(--hx-buy)" : "var(--hx-sell)", ...dimStyle }}
          >
            {change == null ? "—" : `${Number(change) >= 0 ? "+" : ""}${Number(change).toFixed(2)}%`}
          </div>
        </div>

        {/* Inline stats */}
        <div className="flex-1 grid grid-cols-5 text-[10px] uppercase tracking-wider">
          {[
            { k: "SPREAD", v: spread != null ? Number(spread).toFixed(2) : "—" },
            { k: "VWAP", v: vwap != null ? Number(vwap).toFixed(2) : "—" },
            { k: "HI / LO", v: hi != null && lo != null ? `${Number(hi).toFixed(2)} / ${Number(lo).toFixed(2)}` : "—" },
            { k: "EQUITY", v: equity != null ? `$${equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—" },
            { k: "PNL", v: pnl != null ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—", tone: pnl == null ? undefined : pnl >= 0 ? "buy" : "sell" },
          ].map((c, i) => (
            <div key={i} className="px-3 py-2 border-r flex flex-col justify-center" style={{ borderColor: "var(--hx-border)" }}>
              <div style={{ color: "var(--hx-dim)" }} className="flex items-center">{c.k}{stale && staleTag}</div>
              <div className="pixel text-[13px]" style={{ color: c.tone === "buy" ? "var(--hx-buy)" : c.tone === "sell" ? "var(--hx-sell)" : "var(--hx-txt)", ...dimStyle }}>
                {c.v}
              </div>
            </div>
          ))}
        </div>


        {/* Source chips + LOCKED LIVE switch */}
        <div className="px-3 py-2 flex items-center gap-3 border-l" style={{ borderColor: "var(--hx-border)" }}>
          <SourceChips />
          <LiveTradingLock />
        </div>
      </div>
    </header>
  );
}

function SourceChips() {
  const { rows: statuses } = useLiveTable<any>("bot_status", { orderBy: "component", ascending: true, limit: 20 });
  const ds: any = useDashboardStatusPayload();
  const rt = useRealtimeStatus();
  const byKey: Record<string, any> = {};
  statuses.forEach((s) => (byKey[s.component] = s));
  const mt5 = byKey["MT5"]?.status ?? (ds.mt5_connected === true ? "CONNECTED" : ds.mt5_connected === false ? "DOWN" : "—");
  const rdp = byKey["RDP"]?.status ?? "—";
  const sb = rt === "CONNECTED" ? "LIVE" : rt;

  const chip = (label: string, ok: boolean, val: string) => (
    <div
      className="px-2 py-1 text-[9px] uppercase tracking-widest border flex items-center gap-1"
      style={{
        borderColor: ok ? "var(--hx-acc)" : "var(--hx-faint)",
        color: ok ? "var(--hx-acc)" : "var(--hx-dim)",
        background: "var(--hx-panel2)",
      }}
    >
      <span
        className="inline-block"
        style={{ width: 6, height: 6, background: ok ? "var(--hx-buy)" : "var(--hx-faint)" }}
      />
      {label} · {val}
    </div>
  );

  const isOk = (s: any) => {
    const v = String(s ?? "").toUpperCase();
    return v === "CONNECTED" || v === "LIVE" || v === "ONLINE" || v === "OK";
  };

  return (
    <div className="flex gap-1.5">
      {chip("MT5", isOk(mt5), String(mt5))}
      {chip("SUPABASE", isOk(sb), String(sb))}
      {chip("RDP", isOk(rdp), String(rdp))}
    </div>
  );
}

function LiveTradingLock() {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 border"
      style={{ borderColor: "var(--hx-sell)", background: "rgba(234,57,67,0.08)", cursor: "not-allowed" }}
      title="Live trading is permanently blocked. Dashboard is read-only."
      aria-disabled
    >
      <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>LIVE TRADING</span>
      <span
        className="inline-flex items-center"
        style={{ width: 28, height: 14, background: "var(--hx-panel)", border: "1px solid var(--hx-sell)" }}
      >
        <span style={{ width: 10, height: 10, background: "var(--hx-sell)", margin: "0 2px" }} />
      </span>
      <span className="text-[9px] font-bold tracking-widest" style={{ color: "var(--hx-sell)" }}>LOCKED · OFF</span>
    </div>
  );
}

/* ============================================================================
 * SAFETY STRIP (hazard ribbon) + BACKEND HEALTH BAR
 * ========================================================================== */

function SafetyStrip() {
  return (
    <div className="hx-hazard px-3 py-1.5 text-[10px] uppercase tracking-widest flex flex-wrap items-center gap-x-4 gap-y-1 font-bold">
      <span style={{ color: "var(--hx-warn)" }}>⚠ SAFETY</span>
      <span>LIVE TRADING BLOCKED</span>
      <span>·</span>
      <span>DEMO_ONLY TRUE</span>
      <span>·</span>
      <span>ALLOW_LIVE_TRADING FALSE</span>
      <span>·</span>
      <span>MAX LOT 0.01</span>
      <span>·</span>
      <span>MAGIC 909002</span>
      <span>·</span>
      <span>DASHBOARD READ-ONLY</span>
      <span className="ml-auto" style={{ color: "var(--hx-dim)" }}>EXECUTION ONLY FROM BACKEND DEMO ROUTER</span>
    </div>
  );
}

function BackendHealthBar() {
  const h = useBackendHealth();
  const ageColor =
    h.verdict === "OFFLINE" ? "var(--hx-sell)" :
    h.verdict === "STALE_DEGRADED" ? "var(--hx-warn)" : "var(--hx-buy)";
  const status =
    h.verdict === "OFFLINE" ? "OFFLINE" :
    h.verdict === "STALE_DEGRADED" ? "STALE · DEGRADED" : "ONLINE";
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[10px] uppercase tracking-widest border-b"
      style={{ background: "var(--hx-panel2)", borderColor: "var(--hx-border)" }}
    >
      <span style={{ color: "var(--hx-dim)" }}>BACKEND HEALTH</span>
      <span className="flex items-center gap-1.5">
        <span style={{ width: 8, height: 8, background: ageColor, boxShadow: `0 0 8px ${ageColor}` }} className="inline-block hx-pulse" />
        <b style={{ color: ageColor }}>{status}</b>
      </span>
      <span>HB AGE: <b className="pixel">{h.ageSec == null ? "—" : `${h.ageSec}s`}</b></span>
      <span>CHANNEL: <b style={{ color: h.rt === "CONNECTED" ? "var(--hx-buy)" : h.rt === "RECONNECTING" ? "var(--hx-warn)" : "var(--hx-sell)" }}>{h.rt}</b></span>
      <span>INGEST: <b>{h.verdict === "ONLINE" ? "OK" : h.verdict === "OFFLINE" ? "DOWN" : "DEGRADED"}</b></span>
      {!h.tradeReady && (
        <span
          className="ml-auto px-2 py-0.5 border"
          style={{ borderColor: "var(--hx-warn)", color: "var(--hx-warn)", background: "rgba(240,180,41,0.10)" }}
        >
          ⚠ {h.verdict === "OFFLINE" ? "BACKEND OFFLINE — TRADE-READY SUPPRESSED" : "BACKEND STALE · DEGRADED — TRADE-READY SUPPRESSED"}
        </span>
      )}
    </div>
  );
}


/* ============================================================================
 * TABS NAV
 * ========================================================================== */

const TABS = ["OVERVIEW", "ORDER FLOW", "STRATEGIES", "INTELLIGENCE", "JOURNAL", "AUDIT", "LOGS"] as const;
type Tab = typeof TABS[number];

function TabsNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const h = useBackendHealth();
  return (
    <div
      className="flex items-stretch border-b"
      style={{ background: "var(--hx-panel)", borderColor: "var(--hx-border)" }}
    >
      {TABS.map((t) => (
        <button key={t} className="hx-tab" data-active={tab === t} onClick={() => onTab(t)}>
          {t}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-3 px-3 text-[10px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block hx-pulse"
            style={{ width: 6, height: 6, background: h.tradeReady ? "var(--hx-buy)" : "var(--hx-warn)" }}
          />
          <b style={{ color: h.tradeReady ? "var(--hx-buy)" : "var(--hx-warn)" }}>CONNECTED · DEMO</b>
        </span>
        <span>HB AGE <b className="pixel" style={{ color: "var(--hx-txt)" }}>{h.ageSec == null ? "—" : `${h.ageSec}s`}</b></span>
        <span style={{ color: "var(--hx-acc)" }}>READ-ONLY</span>
      </div>
    </div>
  );
}

/* ============================================================================
 * Legacy panels migrated into helpers
 * ========================================================================== */

function PnLTruth() {
  const ds: any = useDashboardStatusPayload();
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 500 });
  const s = snaps[0] ?? {};
  const demoTrades = trades.filter((t: any) => Number(t.magic_number ?? t.magic) === 909002);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: any) => typeof d === "string" && d.slice(0, 10) === today;
  const closedDemo = demoTrades.filter((t: any) => String(t.result ?? "").toUpperCase() === "CLOSED" || t.closed_at != null);
  const openDemo = demoTrades.filter((t: any) => String(t.result ?? "").toUpperCase() === "OPEN" && t.closed_at == null);
  const tradesTablePnl = closedDemo.filter((t: any) => isToday(t.closed_at)).reduce((a: number, t: any) => a + Number(t.pnl ?? 0), 0);
  const mt5Raw = ds.mt5_today_pnl ?? ds.mt5_daily_pnl ?? ds.today_pnl ?? s.daily_pnl ?? null;
  const mt5 = mt5Raw != null ? Number(mt5Raw) : null;
  const floating = openDemo.reduce((a: number, t: any) => {
    const rp: any = t.raw_payload ?? {};
    return a + Number(t.pnl ?? rp.current_profit ?? rp.floating_pnl ?? rp.profit ?? 0);
  }, 0);
  const delta = mt5 != null ? mt5 - tradesTablePnl : null;
  const mismatch = delta != null && Math.abs(delta) > 0.01;
  const total = (mt5 ?? tradesTablePnl) + floating;

  return (
    <Panel
      title="PNL TRUTH · MT5_HISTORY_DEALS"
      right={
        <Badge value={mt5 != null ? "PRIMARY: MT5" : "FALLBACK: TRADES"} tone={mt5 != null ? "green" : "orange"} />
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[9px] uppercase opacity-70">Total Demo PnL</div>
          <div
            className="pixel text-[42px] leading-none"
            style={{ color: total >= 0 ? "var(--hx-buy)" : "var(--hx-sell)" }}
          >
            {total >= 0 ? "+" : "-"}${Math.abs(total).toFixed(2)}
          </div>
          <div className="text-[10px] mt-1" style={{ color: "var(--hx-dim)" }}>
            Closed + floating · Magic 909002
          </div>
        </div>
        <div className="space-y-1">
          <KV k="MT5 Closed (PRIMARY)" v={mt5 != null ? `${mt5 >= 0 ? "+" : ""}$${mt5.toFixed(2)}` : <Fallback tone="nodata" />} accent={mt5 != null && mt5 >= 0 ? "profit" : mt5 != null ? "loss" : undefined} />
          <KV k="Trades Table (SECONDARY)" v={`${tradesTablePnl >= 0 ? "+" : ""}$${tradesTablePnl.toFixed(2)}`} />
          <KV k="Floating Demo PnL" v={`${floating >= 0 ? "+" : ""}$${floating.toFixed(2)}`} accent={floating >= 0 ? "profit" : "loss"} />
        </div>
        <div className="space-y-1">
          <KV k="Open Positions" v={openDemo.length} />
          <KV k="Reconciliation Δ" v={delta == null ? "—" : `${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}`} />
          <div className="mt-1">
            {mismatch
              ? <Fallback tone="degraded" label="PNL_MISMATCH" />
              : delta != null ? <Badge value="RECONCILED" tone="green" /> : <Fallback tone="wait" />}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function LatestAiDecisionCard() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp: any = (d?.raw_payload ?? {});
  const inner: any = (rp?.raw_payload ?? {});
  const merged = { ...rp, ...inner };
  const finalCap = merged.final_capped_lot ?? merged.demo_capped_lot ?? merged.gate_statuses?.final_lot;
  const executableLot = finalCap != null ? Math.min(Number(finalCap), 0.01) : null;
  const rawLot = merged.raw_lot ?? merged.calculated_lot ?? merged.kelly_suggested_lot ?? d?.lot_size;
  const gate = String(merged.demo_gate ?? merged.gate_status ?? "").toUpperCase();
  const h = useBackendHealth();
  const stamp = h.tradeReady && gate === "PASS" ? "TRADE READY · DEMO ROUTER" : "ANALYSIS ONLY";
  const stampTone = h.tradeReady && gate === "PASS" ? "green" : "orange";

  return (
    <Panel title="LATEST AI DECISION" right={<Badge value={stamp} tone={stampTone} />}>
      {empty || !d ? <Fallback tone="wait" block /> : (
        <div className="grid grid-cols-2 gap-x-4">
          <KV k="Symbol" v={d.symbol ?? <Fallback tone="nodata" />} />
          <KV k="Timeframe" v={d.timeframe ?? <Fallback tone="nodata" />} />
          <KV k="Strategy" v={d.strategy ?? <Fallback tone="nodata" />} />
          <KV k="Signal" v={d.signal ?? <Fallback tone="nodata" />} accent="profit" />
          <KV k="Confidence" v={`${d.confidence ?? 0}%`} />
          <KV k="Markov p" v={Number(d.markov_probability ?? 0).toFixed(2)} />
          <KV k="Raw Lot" v={rawLot != null ? Number(rawLot).toFixed(4) : <Fallback tone="nodata" />} />
          <KV k="Executable Lot" v={executableLot != null ? executableLot.toFixed(4) : "0.0100"} accent="profit" />
          <KV k="Entry" v={d.entry ?? <Fallback tone="nodata" />} />
          <KV k="SL" v={d.sl ?? <Fallback tone="nodata" />} accent="loss" />
          <KV k="TP" v={d.tp ?? <Fallback tone="nodata" />} accent="profit" />
          <KV k="Risk Status" v={d.risk_status ?? <Fallback tone="nodata" />} />
          <div className="col-span-2 mt-2 pt-1.5 border-t" style={{ borderColor: "var(--hx-border)" }}>
            <div className="text-[9px] uppercase" style={{ color: "var(--hx-dim)" }}>Decision</div>
            <div className="pixel text-[18px]">{d.decision ?? "—"}</div>
            <div className="text-[10px] mt-1" style={{ color: "var(--hx-dim)" }}><b>REASON:</b> {d.reason ?? <Fallback tone="nodata" />}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function MetricsRowDemo() {
  const ds: any = useDashboardStatusPayload();
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 500 });
  const s = snaps[0] ?? {};
  const demo = trades.filter((t: any) => Number(t.magic_number ?? t.magic) === 909002);
  const closed = demo.filter((t: any) => t.closed_at != null);
  const open = demo.filter((t: any) => String(t.result ?? "").toUpperCase() === "OPEN" && t.closed_at == null);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: any) => typeof d === "string" && d.slice(0, 10) === today;
  const closedToday = closed.filter((t: any) => isToday(t.closed_at)).reduce((a, t: any) => a + Number(t.pnl ?? 0), 0);
  const mt5 = ds.mt5_today_pnl ?? ds.mt5_daily_pnl ?? ds.today_pnl ?? s.daily_pnl ?? null;
  const wins = closed.filter((t: any) => Number(t.pnl ?? 0) > 0).length;
  const losses = closed.filter((t: any) => Number(t.pnl ?? 0) < 0).length;
  const wr = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;

  const items = [
    { k: "Trades Today", v: demo.filter((t: any) => isToday(t.opened_at ?? t.created_at)).length },
    { k: "Total Trades", v: demo.length },
    { k: "Win Rate", v: wr == null ? "—" : `${wr}%` },
    { k: "Closed (MT5)", v: mt5 != null ? `${Number(mt5) >= 0 ? "+" : ""}$${Number(mt5).toFixed(2)}` : `${closedToday >= 0 ? "+" : ""}$${closedToday.toFixed(2)}`, tone: (Number(mt5 ?? closedToday) >= 0 ? "profit" : "loss") as "profit" | "loss" },
    { k: "Equity", v: `$${Number(s.equity ?? 0).toLocaleString("en-US")}` },
    { k: "Profit Factor", v: s.profit_factor ?? "—" },
    { k: "Open Pos", v: open.length },
    { k: "Max DD", v: `${s.max_drawdown ?? 0}%`, tone: "loss" as const },
  ];
  return (
    <div className="grid grid-cols-8 border" style={{ borderColor: "var(--hx-border)", background: "var(--hx-panel)" }}>
      {items.map((it, i) => (
        <div key={i} className="p-2 border-r last:border-r-0" style={{ borderColor: "var(--hx-border)" }}>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>{it.k}</div>
          <div
            className="pixel text-[20px]"
            style={{ color: it.tone === "profit" ? "var(--hx-buy)" : it.tone === "loss" ? "var(--hx-sell)" : "var(--hx-txt)" }}
          >
            {it.v}
          </div>
        </div>
      ))}
    </div>
  );
}

function Markov() {
  const { rows, empty } = useLiveTable<any>("markov_predictions", { limit: 1 });
  const m = rows[0];
  return (
    <Panel title="MARKOV STATE" right={m ? `${m.symbol} ${m.timeframe}` : "—"}>
      {empty || !m ? <Fallback tone="wait" block /> : (
        <>
          <div className="grid grid-cols-5 items-center gap-2 my-1">
            <div className="col-span-2 text-center">
              <div className="text-[9px] uppercase opacity-70">Current</div>
              <div className="pixel text-[26px] leading-none" style={{ color: "var(--hx-acc)" }}>{m.current_state}</div>
            </div>
            <div className="text-center text-[22px]" style={{ color: "var(--hx-dim)" }}>→</div>
            <div className="col-span-2 text-center">
              <div className="text-[9px] uppercase opacity-70">Predicted</div>
              <div className="pixel text-[26px] leading-none" style={{ color: "var(--hx-acc)" }}>{m.predicted_state}</div>
            </div>
          </div>
          <KV k="Probability" v={`p = ${Number(m.probability).toFixed(2)}`} />
          <KV k="Signal" v={m.signal ?? "—"} />
          <KV k="Persistence" v={m.persistence_bars ?? "—"} />
          <KV k="Transitions" v={m.transitions ?? "—"} />
        </>
      )}
    </Panel>
  );
}

function Kelly() {
  const { rows, empty } = useLiveTable<any>("kelly_risk", { limit: 1 });
  const k = rows[0];
  return (
    <Panel title="KELLY · DEMO ROUTER" right="f* = p−(1−p)/b">
      {empty || !k ? <Fallback tone="wait" block /> : (() => {
        const raw: any = (k.raw_payload ?? {});
        const status = (k.risk_status ?? k.status ?? raw.risk_status ?? "—") as string;
        const blocked = String(status).toUpperCase() === "BLOCKED";
        const rawLot = Number(raw.raw_lot ?? raw.calculated_lot ?? k.lot_size ?? 0);
        const exec = blocked ? 0 : Math.min(Number(k.lot_size ?? 0), 0.01);
        return (
          <>
            <KV k="Model p" v={Number(k.model_probability ?? 0).toFixed(2)} />
            <KV k="R/R" v={Number(k.reward_risk ?? 0).toFixed(1)} />
            <KV k="Edge" v={`${k.edge ?? 0}%`} />
            <KV k="Fractional Kelly" v={Number(k.kelly_fraction ?? 0).toFixed(2)} />
            <KV k="Raw Lot (theoretical)" v={rawLot.toFixed(4)} />
            <KV k="Final Capped Lot (≤0.01)" v={exec.toFixed(4)} accent="profit" />
            <div className="mt-2">
              <Badge value={`RISK: ${status}`} tone={blocked ? "red" : "green"} />
            </div>
            {blocked && (
              <div className="mt-1 text-[10px]" style={{ color: "var(--hx-warn)" }}>
                <b>BLOCKED:</b> {k.blocked_reason ?? raw.blocked_reason ?? "—"}
              </div>
            )}
          </>
        );
      })()}
    </Panel>
  );
}

/* ============================================================================
 * ORDER FLOW TERMINAL (visual scaffolding bound to existing snapshot)
 * ========================================================================== */

function useOrderFlowFor(symbolKey: SymbolKey) {
  const ds: any = useDashboardStatusPayload();
  const sym = SYMBOL_MAP[symbolKey];
  const container = ds.order_flow_reader ?? ds.raw_payload?.order_flow_reader ?? {};
  // try keyed snapshot for symbol
  const candidate =
    container?.[sym] ?? container?.[sym.toLowerCase()] ??
    (Array.isArray(container) ? container.find((x: any) => isSameSymbol(x?.symbol, sym)) : null) ??
    (container?.symbol && isSameSymbol(container.symbol, sym) ? container : null);
  return candidate ?? null;
}

function OrderFlowHeader({ symbolKey }: { symbolKey: SymbolKey }) {
  const snap: any = useOrderFlowFor(symbolKey) ?? {};
  const cell = (k: string, v: any) => (
    <div className="px-3 py-1.5 border-r" style={{ borderColor: "var(--hx-border)" }}>
      <div className="text-[9px] uppercase" style={{ color: "var(--hx-dim)" }}>{k}</div>
      <div className="pixel text-[13px]">{v == null || v === "" ? <Fallback tone="nodata" /> : v}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-7 border" style={{ borderColor: "var(--hx-border)", background: "var(--hx-panel)" }}>
      {cell("VWAP", snap.vwap)}
      {cell("POC", snap.poc)}
      {cell("VAH", snap.vah)}
      {cell("VAL", snap.val)}
      {cell("CVD slope", snap.cvd_slope)}
      {cell("Δ proxy", snap.delta_proxy)}
      {cell("Divergence", snap.divergence)}
    </div>
  );
}

function HeatmapCanvas({ symbolKey }: { symbolKey: SymbolKey }) {
  // Visual scaffold; reads existing market_candles for the symbol path
  const sym = SYMBOL_MAP[symbolKey];
  const { rows } = useLiveTable<any>("market_candles", {
    limit: 80,
    filter: { column: "symbol", value: sym },
  });
  const candles = [...rows].reverse();
  const hasData = candles.length > 4;
  return (
    <Panel title="LIQUIDITY HEATMAP" right={<Badge value="OBSERVE ONLY" tone="green" />}>
      <div className="hx-canvas relative" style={{ height: 280 }}>
        {!hasData ? (
          <div className="absolute inset-0 grid place-items-center"><Fallback tone="wait" block /></div>
        ) : (
          <svg width="100%" height="100%" viewBox="0 0 800 280" preserveAspectRatio="none">
            {/* heatmap bands (decorative; bid/ask) */}
            {Array.from({ length: 24 }).map((_, i) => (
              <rect
                key={`a${i}`}
                x={0} y={i * 5}
                width="800" height="5"
                fill={`rgba(234,57,67,${0.04 + Math.random() * 0.06})`}
              />
            ))}
            {Array.from({ length: 24 }).map((_, i) => (
              <rect
                key={`b${i}`}
                x={0} y={160 + i * 5}
                width="800" height="5"
                fill={`rgba(47,129,247,${0.04 + Math.random() * 0.06})`}
              />
            ))}
            {/* price path */}
            {(() => {
              const closes = candles.map((c: any) => Number(c.close ?? c.c ?? 0)).filter(Number.isFinite);
              if (closes.length < 2) return null;
              const min = Math.min(...closes), max = Math.max(...closes);
              const range = max - min || 1;
              const pts = closes.map((v, i) => {
                const x = (i / (closes.length - 1)) * 800;
                const y = 280 - ((v - min) / range) * 240 - 20;
                return `${x},${y}`;
              }).join(" ");
              const vwapMean = closes.reduce((a, b) => a + b, 0) / closes.length;
              const vy = 280 - ((vwapMean - min) / range) * 240 - 20;
              return (
                <>
                  <polyline fill="none" stroke="#ffffff" strokeWidth="1.5" points={pts} />
                  <line x1="0" y1={vy} x2="800" y2={vy} stroke="#f0b429" strokeWidth="1" strokeDasharray="4 4" />
                </>
              );
            })()}
          </svg>
        )}
      </div>
      <div className="text-[10px] mt-1 uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>
        ask red · bid blue · price white · VWAP dashed amber
      </div>
    </Panel>
  );
}

function DomLadder({ symbolKey }: { symbolKey: SymbolKey }) {
  const sym = SYMBOL_MAP[symbolKey];
  const { rows } = useLiveTable<any>("market_states", { limit: 1, filter: { column: "symbol", value: sym } });
  const price = Number(rows[0]?.price ?? 0);
  const tickSize = sym === "BTCUSD" ? 1 : sym === "XAUUSD" ? 0.1 : 0.0001;
  const levels = price > 0
    ? Array.from({ length: 21 }).map((_, i) => price + (10 - i) * tickSize)
    : [];
  return (
    <Panel title="DOM LADDER" right={<Badge value="OBSERVE ONLY" tone="green" />}>
      {levels.length === 0 ? <Fallback tone="wait" block /> : (
        <div className="hx-canvas text-[10px]" style={{ maxHeight: 280, overflow: "auto" }}>
          {levels.map((p, i) => {
            const isCenter = i === 10;
            const isAsk = i < 10;
            const sz = Math.round(20 + Math.random() * 180);
            const wall = sz > 150;
            return (
              <div
                key={i}
                className="grid grid-cols-3 px-2 py-0.5 border-b"
                style={{
                  borderColor: "rgba(25,34,49,0.6)",
                  background: isCenter ? "rgba(45,212,191,0.10)" : "transparent",
                  outline: wall ? "1px solid var(--hx-warn)" : "none",
                  outlineOffset: -1,
                }}
              >
                <span style={{ color: isAsk ? "var(--hx-ask)" : "var(--hx-bid)" }} className="pixel">{isAsk ? sz : ""}</span>
                <span className="pixel text-center" style={{ color: isCenter ? "var(--hx-acc)" : "var(--hx-txt)", fontWeight: isCenter ? 700 : 400 }}>
                  {p.toFixed(sym === "EURUSD" ? 5 : 2)}
                </span>
                <span style={{ color: isAsk ? "var(--hx-ask)" : "var(--hx-bid)" }} className="pixel text-right">{!isAsk ? sz : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function TradeTape() {
  const { rows } = useLiveTable<any>("trades", { limit: 14 });
  return (
    <Panel title="TRADE TAPE · LIQUIDITY EVENTS">
      {rows.length === 0 ? <Fallback tone="wait" block /> : (
        <div className="hx-canvas text-[10px] p-1" style={{ maxHeight: 280, overflow: "auto" }}>
          {rows.map((t: any) => {
            const buy = String(t.dir ?? "").toUpperCase().startsWith("B");
            return (
              <div key={t.id} className="grid grid-cols-5 gap-1 px-1 py-0.5 border-b" style={{ borderColor: "rgba(25,34,49,0.6)" }}>
                <span className="pixel" style={{ color: "var(--hx-dim)" }}>
                  {new Date(t.opened_at ?? t.created_at).toISOString().slice(11, 19)}
                </span>
                <span style={{ color: buy ? "var(--hx-buy)" : "var(--hx-sell)" }}>{t.dir ?? "—"}</span>
                <span>{t.symbol}</span>
                <span className="pixel">{t.entry ?? "—"}</span>
                <span className="pixel text-right" style={{ color: (t.pnl ?? 0) >= 0 ? "var(--hx-buy)" : "var(--hx-sell)" }}>
                  {(t.pnl ?? 0) >= 0 ? "+" : ""}{t.pnl ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================================
 * BOTTOM STRIP (CVD + monitor)
 * ========================================================================== */

function CvdStrip({ symbolKey }: { symbolKey: SymbolKey }) {
  const sym = SYMBOL_MAP[symbolKey];
  const { rows } = useLiveTable<any>("market_candles", {
    limit: 60,
    filter: { column: "symbol", value: sym },
  });
  const candles = [...rows].reverse();
  let cvd = 0;
  const series = candles.map((c: any) => {
    const buy = Number(c.close ?? 0) >= Number(c.open ?? 0);
    const vol = Number(c.volume ?? c.tick_volume ?? 1);
    cvd += buy ? vol : -vol;
    return cvd;
  });
  const delta = series.length ? series[series.length - 1] - series[0] : 0;
  const totalVol = candles.reduce((a: number, c: any) => a + Number(c.volume ?? c.tick_volume ?? 0), 0);

  return (
    <div
      className="grid grid-cols-12 border-t"
      style={{ background: "var(--hx-panel)", borderColor: "var(--hx-border)" }}
    >
      <div className="col-span-3 grid grid-cols-3 border-r" style={{ borderColor: "var(--hx-border)" }}>
        {[
          { k: "VOLUME", v: totalVol ? totalVol.toLocaleString("en-US") : "—" },
          { k: "DELTA", v: delta ? (delta >= 0 ? "+" : "") + delta.toFixed(0) : "—", tone: delta >= 0 ? "buy" : "sell" },
          { k: "CVD", v: series.length ? cvd.toFixed(0) : "—" },
        ].map((c, i) => (
          <div key={i} className="p-2 border-r last:border-r-0" style={{ borderColor: "var(--hx-border)" }}>
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>{c.k}</div>
            <div
              className="pixel text-[18px]"
              style={{ color: c.tone === "buy" ? "var(--hx-buy)" : c.tone === "sell" ? "var(--hx-sell)" : "var(--hx-txt)" }}
            >
              {c.v}
            </div>
          </div>
        ))}
      </div>
      <div className="col-span-6 p-2 border-r" style={{ borderColor: "var(--hx-border)" }}>
        <div className="flex items-center justify-between text-[9px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>
          <span>CVD · {sym}</span>
          <span style={{ color: delta >= 0 ? "var(--hx-buy)" : "var(--hx-sell)" }}>{delta >= 0 ? "BULLISH" : "BEARISH"}</span>
        </div>
        <div className="hx-canvas mt-1" style={{ height: 64 }}>
          {series.length < 2 ? (
            <div className="grid place-items-center h-full"><Fallback tone="wait" /></div>
          ) : (() => {
            const min = Math.min(...series), max = Math.max(...series);
            const range = max - min || 1;
            const pts = series.map((v, i) => {
              const x = (i / (series.length - 1)) * 800;
              const y = 64 - ((v - min) / range) * 56 - 4;
              return `${x},${y}`;
            }).join(" ");
            return (
              <svg width="100%" height="100%" viewBox="0 0 800 64" preserveAspectRatio="none">
                <polyline fill="none" stroke={delta >= 0 ? "#16c784" : "#ea3943"} strokeWidth="1.5" points={pts} />
              </svg>
            );
          })()}
        </div>
      </div>
      <div className="col-span-3 p-2 flex flex-col gap-1.5">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>Monitor · READ-ONLY</div>
        <div className="grid grid-cols-2 gap-1.5">
          {["START MONITORING", "STOP MONITORING", "REFRESH"].map((b) => (
            <button
              key={b}
              className="border px-2 py-1.5 text-[10px] uppercase tracking-widest"
              style={{ borderColor: "var(--hx-border)", color: "var(--hx-dim)", background: "var(--hx-panel2)" }}
            >
              {b}
            </button>
          ))}
          <div
            className="border px-2 py-1.5 text-[10px] uppercase tracking-widest text-center"
            style={{ borderColor: "var(--hx-sell)", color: "var(--hx-sell)", background: "rgba(234,57,67,0.06)" }}
            title="No order actions exposed in this dashboard"
          >
            NO ORDER ACTIONS
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * AUDIT panels
 * ========================================================================== */

function DataFreshnessPanel() {
  const h = useBackendHealth();
  const { ageSec } = h;
  const cell = (k: string, ok: boolean, v: string) => (
    <div className="border p-2" style={{ borderColor: "var(--hx-border)" }}>
      <div className="text-[9px] uppercase" style={{ color: "var(--hx-dim)" }}>{k}</div>
      <div className="pixel text-[14px]" style={{ color: ok ? "var(--hx-buy)" : "var(--hx-warn)" }}>{v}</div>
    </div>
  );
  return (
    <Panel title="DATA FRESHNESS">
      <div className="grid grid-cols-4 gap-2">
        {cell("dashboard_status", ageSec != null && ageSec < 30, ageSec == null ? "—" : `${ageSec}s`)}
        {cell("supabase channel", h.rt === "CONNECTED", h.rt)}
        {cell("ingest", h.tradeReady, h.tradeReady ? "OK" : "DEGRADED")}
        {cell("trade-ready", h.tradeReady, h.tradeReady ? "ELIGIBLE" : "SUPPRESSED")}
      </div>
    </Panel>
  );
}

function ChartSymbolTruth({ chartSymbol }: { chartSymbol: string }) {
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const decisionSymbol = dec[0]?.symbol ?? null;
  const aligned = !decisionSymbol || isSameSymbol(decisionSymbol, chartSymbol);
  return (
    <Panel title="CHART SYMBOL TRUTH">
      <div className="grid grid-cols-3 gap-2">
        <KV k="Chart" v={normalizeSymbol(chartSymbol)} />
        <KV k="Decision" v={decisionSymbol ? normalizeSymbol(decisionSymbol) : <Fallback tone="nodata" />} />
        <div className="flex items-center">
          {aligned ? <Badge value="ALIGNED" tone="green" /> : <Fallback tone="degraded" label="SYMBOL MISMATCH" />}
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================================
 * Tabs content
 * ========================================================================== */

function TabOverview({ symbol }: { symbol: SymbolKey }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12"><DemoModeBanner /></div>
      <div className="col-span-8"><PnLTruth /></div>
      <div className="col-span-4"><BackendHealthPanel /></div>
      <div className="col-span-12"><MetricsRowDemo /></div>
      <div className="col-span-12"><StrategyManagerPanel /></div>
      <div className="col-span-7"><LatestAiDecisionCard /></div>
      <div className="col-span-5"><DemoAlerts /></div>
      <div className="col-span-6"><DemoPilotStatus /></div>
      <div className="col-span-6"><TimeEnginePanel /></div>
      <div className="col-span-12"><ChartSymbolTruth chartSymbol={SYMBOL_MAP[symbol]} /></div>
    </div>
  );
}

function TabOrderFlow({ symbol }: { symbol: SymbolKey }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12"><OrderFlowHeader symbolKey={symbol} /></div>
      <div className="col-span-5"><HeatmapCanvas symbolKey={symbol} /></div>
      <div className="col-span-3"><DomLadder symbolKey={symbol} /></div>
      <div className="col-span-2"><TradeTape /></div>
      <div className="col-span-2"><LatestAiDecisionCard /></div>
      <div className="col-span-12"><OrderFlowReaderPanel /></div>
      <div className="col-span-12">
        <Panel title="OBSERVE-ONLY NOTICE">
          <div className="text-[11px]" style={{ color: "var(--hx-dim)" }}>
            Order Flow Reader is observe-only. It does not execute trades and does not block other strategies.
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TabStrategies({ symbol }: { symbol: SymbolKey }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12"><StrategyManagerPanel /></div>
      <div className="col-span-12"><SimoAtmBreakoutPanel /></div>
      <div className="col-span-6"><BtcScalpingPanel /></div>
      <div className="col-span-6"><EurEmaRsiAtrPanel /></div>
      <div className="col-span-6"><GoldLiquidityHunter /></div>
      <div className="col-span-6"><GoldOrderFlowCvdVwapPanelGated /></div>
      <div className="col-span-12"><QuantProStrategyPanel /></div>
      <div className="col-span-12"><QuantStrategyPanel /></div>
      <div className="col-span-4"><StrategyCountCard /></div>
      <div className="col-span-8"><StrategyModules /></div>
      <div className="col-span-12"><SkipEngine /></div>
      <div className="col-span-12"><QuickExitManager /></div>
      <SymbolEcho symbol={symbol} />
    </div>
  );
}

function SymbolEcho({ symbol }: { symbol: SymbolKey }) {
  return (
    <div className="col-span-12 text-[10px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>
      Active symbol focus: <b style={{ color: "var(--hx-acc)" }}>{SYMBOL_MAP[symbol]}</b> · use top-bar symbol tabs to switch context.
    </div>
  );
}

function GoldOrderFlowCvdVwapPanelGated() {
  const ds: any = useDashboardStatusPayload();
  const raw = ds?.gold_order_flow_cvd_vwap ?? ds?.GOLD_ORDER_FLOW_CVD_VWAP ?? ds?.raw_payload?.gold_order_flow_cvd_vwap ?? {};
  const executionEnabled = raw.execution_enabled === true || ds?.gold_order_flow_execution_enabled === true;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
        <Badge value={executionEnabled ? "EXECUTION ENABLED (BACKEND)" : "DISABLED · OBSERVE-ONLY"} tone={executionEnabled ? "green" : "gray"} />
        <span style={{ color: "var(--hx-dim)" }}>GOLD only · BTCUSD & EURUSD never show this card</span>
      </div>
      <div className={executionEnabled ? "" : "opacity-80 pointer-events-none"}>
        <GoldOrderFlowCvdVwapPanel />
      </div>
    </div>
  );
}

function SkipEngine() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 20 });
  const skipped = rows.filter((r) => (r.decision ?? "").toUpperCase() === "SKIP").slice(0, 6);
  return (
    <Panel title="SIGNAL SKIP ENGINE" right={`SKIPPED: ${skipped.length}`}>
      {empty || skipped.length === 0 ? <Fallback tone="wait" block /> : (
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b uppercase tracking-wider text-left" style={{ borderColor: "var(--hx-border)" }}>
              <th className="py-1">Time</th><th>Symbol</th><th>Strategy</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {skipped.map((s) => (
              <tr key={s.id} className="border-b border-dashed" style={{ borderColor: "rgba(25,34,49,0.6)" }}>
                <td className="py-1 pixel" style={{ color: "var(--hx-dim)" }}>{new Date(s.created_at).toISOString().slice(11, 19)}</td>
                <td>{s.symbol}</td>
                <td>{s.strategy}</td>
                <td style={{ color: "var(--hx-sell)" }}>{s.blocked_reason ?? s.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function TabIntelligence() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-6"><ConfluenceEnginePanel /></div>
      <div className="col-span-6"><GeometryEnginePanel /></div>
      <div className="col-span-12"><SmcMtfaPanel /></div>
      <div className="col-span-12"><TopDownReader /></div>
      <div className="col-span-12"><TimeframeHierarchyPanel /></div>
      <div className="col-span-6"><Markov /></div>
      <div className="col-span-6"><Kelly /></div>
      <div className="col-span-12"><BigSetupDetector /></div>
      <div className="col-span-12"><WspChartWorkspace /></div>
      <div className="col-span-12"><SmcMap /></div>
      <div className="col-span-12"><SafetyGuard /></div>
    </div>
  );
}

function TopDownReader() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const ds: any = useDashboardStatusPayload();
  const d = rows[0];
  const rp: any = (d?.raw_payload ?? {});
  const inner: any = (rp?.raw_payload ?? {});
  const latest: any = (rp?.latest_decision ?? ds?.latest_decision ?? {});
  const m: any = { ...ds, ...rp, ...inner, ...latest };
  const pick = (...keys: string[]) => { for (const k of keys) { const v = m?.[k]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; };
  const status = pick("top_down_status");
  const decision = pick("top_down_decision");
  const score = pick("entry_readiness_score", "readiness_score");
  const narrative = pick("market_narrative", "narrative");
  const missingRaw = pick("missing_confirmations");
  const breakdown: any = (pick("score_breakdown") ?? {});
  const missing: string[] = Array.isArray(missingRaw) ? missingRaw.map(String) : typeof missingRaw === "string" ? missingRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
  const hasAny = status != null || decision != null || score != null || narrative != null || missing.length > 0 || Object.keys(breakdown).length > 0;
  return (
    <Panel title="TOP-DOWN MARKET READER" right="LATEST · READ-ONLY">
      {!hasAny ? <Fallback tone="wait" block /> : (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-4 space-y-1">
            <KV k="Status" v={<Badge value={String(status ?? "—").toUpperCase()} tone={String(status ?? "").toUpperCase() === "PASS" ? "green" : String(status ?? "").toUpperCase() === "WAIT" ? "orange" : String(status ?? "").toUpperCase() === "FAIL" ? "red" : "gray"} />} />
            <KV k="Decision" v={<Badge value={String(decision ?? "—").toUpperCase()} tone={String(decision ?? "").toUpperCase() === "ALLOW_DEMO" ? "green" : String(decision ?? "").toUpperCase() === "WAIT_FOR_CONFIRMATION" ? "orange" : String(decision ?? "").toUpperCase() === "AVOID" ? "red" : "gray"} />} />
            <KV k="Readiness" v={score != null ? `${score}/100` : <Fallback tone="nodata" />} />
          </div>
          <div className="col-span-8">
            <div className="text-[9px] uppercase" style={{ color: "var(--hx-dim)" }}>Narrative</div>
            <div className="text-[11px] mt-0.5">{narrative ? String(narrative) : <Fallback tone="wait" />}</div>
            <div className="text-[9px] uppercase mt-2" style={{ color: "var(--hx-dim)" }}>Missing Confirmations</div>
            {missing.length === 0 ? <div className="text-[10px]" style={{ color: "var(--hx-dim)" }}>None</div> : (
              <ul className="text-[10px] list-disc pl-4 space-y-0.5">{missing.map((it, i) => <li key={i}>{it}</li>)}</ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function TabJournal() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-7"><DemoReport /></div>
      <div className="col-span-5"><MissingFieldsPanel /></div>
      <div className="col-span-12"><TradeJournalTabs /></div>
      <div className="col-span-12"><PaperReport /></div>
      <div className="col-span-12"><SelfLearn /></div>
    </div>
  );
}

function SelfLearn() {
  const { rows, empty } = useLiveTable<any>("nightly_reports", { orderBy: "report_date", ascending: false, limit: 1 });
  const r: any = rows[0];
  const p: any = (r?.payload ?? r?.raw_payload ?? {});
  const u = (v: any) => (v == null || v === "" ? "WAITING FOR NIGHTLY REPORT" : v);
  return (
    <Panel title="SELF-LEARNING NIGHTLY LOOP" right="03:00 UTC">
      {empty || !r ? <Fallback tone="wait" block label="WAITING FOR NEW REPORT" /> : (
        <div className="grid grid-cols-4 gap-0">
          {[
            { n: "01", t: "BEST SETUP", d: u(r.best_setup ?? p.best_setup) },
            { n: "02", t: "WORST SETUP", d: u(r.worst_setup ?? p.worst_setup) },
            { n: "03", t: "BEST GRADE", d: u(p.best_big_setup_grade) },
            { n: "04", t: "WORST GRADE", d: u(p.worst_big_setup_grade) },
            { n: "05", t: "BEST STRATEGY", d: u(p.best_strategy) },
            { n: "06", t: "WORST STRATEGY", d: u(p.worst_strategy) },
            { n: "07", t: "ACTIVE STRATEGIES", d: Array.isArray(p.active_strategies) ? p.active_strategies.join(", ") : u(p.active_strategies) },
            { n: "08", t: "LEGACY OBSERVER", d: Array.isArray(p.legacy_observer_strategies) ? p.legacy_observer_strategies.join(", ") : u(p.legacy_observer_strategies) },
          ].map((s, i) => (
            <div key={s.n} className={`p-2 ${i % 4 !== 3 ? "border-r border-dashed" : ""} ${i < 4 ? "border-b border-dashed" : ""}`} style={{ borderColor: "rgba(25,34,49,0.7)" }}>
              <div className="pixel text-[20px] leading-none" style={{ color: "var(--hx-acc)" }}>{s.n}</div>
              <div className="font-bold text-[11px] mt-1">{s.t}</div>
              <div className="text-[10px] mt-1 leading-snug" style={{ color: "var(--hx-dim)" }}>{s.d}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function TabAudit({ symbol }: { symbol: SymbolKey }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12"><PnLTruth /></div>
      <div className="col-span-6"><DataFreshnessPanel /></div>
      <div className="col-span-6"><ChartSymbolTruth chartSymbol={SYMBOL_MAP[symbol]} /></div>
      <div className="col-span-6"><DemoGateChecklist /></div>
      <div className="col-span-6"><KellyDemoPanel /></div>
      <div className="col-span-12"><HermesAuditPanel /></div>
      <div className="col-span-12"><MissingFieldsPanel /></div>
    </div>
  );
}

function TabLogs() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12"><LogsTerminal /></div>
      <div className="col-span-7"><LiveSyncDebugPanel /></div>
      <div className="col-span-5"><Stack /></div>
    </div>
  );
}

function Stack() {
  const { rows, empty } = useLiveTable<any>("bot_status", { orderBy: "component", ascending: true, limit: 10 });
  return (
    <Panel title="TRADING STACK" right={`${rows.length} NODES`}>
      {empty ? <Fallback tone="wait" block /> : (
        <div className="grid grid-cols-1 gap-2">
          {rows.slice(0, 8).map((n) => (
            <div key={n.id} className="border p-2 flex items-center justify-between" style={{ borderColor: "var(--hx-border)" }}>
              <div>
                <div className="font-bold text-[11px]">{n.component}</div>
                <div className="text-[9px]" style={{ color: "var(--hx-dim)" }}>{n.meta?.desc ?? ""}</div>
              </div>
              <div className="text-right text-[10px]">
                <div style={{ color: "var(--hx-buy)" }}>{n.status ?? "—"}</div>
                <div style={{ color: "var(--hx-dim)" }} className="pixel">{n.latency_ms != null ? `${n.latency_ms}ms` : "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function pickTimeStr(rp: any, key: string): string {
  if (!rp) return "UNKNOWN";
  const v = rp[key];
  if (v == null || v === "") return "UNKNOWN";
  const s = String(v);
  const m = s.match(/\d{2}:\d{2}:\d{2}/) ?? s.match(/\d{2}:\d{2}/);
  return m ? m[0] : s;
}

function LogsTerminal() {
  const { rows, empty } = useLiveTable<any>("bot_logs", { orderBy: "created_at", ascending: false, limit: 80 });
  const ds: any = useDashboardStatusPayload();
  const [showHistorical, setShowHistorical] = useState(false);
  const pilotStartedAt = ds?.pilot_started_at ?? ds?.demo_pilot_started_at ?? null;
  const pilotStartMs = pilotStartedAt ? Date.parse(pilotStartedAt) : NaN;
  const headerTs = ds?.updated_at ?? ds?.utc_time ?? null;
  const filtered = !showHistorical && !isNaN(pilotStartMs)
    ? rows.filter((l: any) => { const t = Date.parse(l.created_at); return isNaN(t) || t >= pilotStartMs; })
    : rows;
  const ordered = [...filtered].reverse();
  return (
    <Panel title="LOGS TERMINAL" right={`BACKEND TIME · ${headerTs ?? "UNKNOWN"}`}>
      <div className="flex items-center justify-between mb-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>
        <span>PILOT START: {pilotStartedAt ?? "UNKNOWN"}</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={showHistorical} onChange={(e) => setShowHistorical(e.target.checked)} />
          SHOW HISTORICAL
        </label>
      </div>
      <div className="hx-canvas p-2 text-[10px] leading-snug" style={{ maxHeight: 360, overflow: "auto", fontFamily: "var(--font-mono)" }}>
        {empty || ordered.length === 0 ? (
          <div style={{ color: "var(--hx-dim)" }}>$ WAITING FOR HERMES LIVE LOGS <span className="blink">█</span></div>
        ) : ordered.map((l: any) => {
          const rp = l.raw_payload ?? {};
          return (
            <div key={l.id}>
              <span style={{ color: "var(--hx-dim)" }}>$</span>{" "}
              <span style={{ color: "var(--hx-acc)" }}>[UTC {pickTimeStr(rp, "utc_time")} | CASA {pickTimeStr(rp, "casablanca_time")} | BRK {pickTimeStr(rp, "broker_time_estimate") ?? pickTimeStr(rp, "broker_time")}]</span>{" "}
              <span style={{ color: "var(--hx-warn)" }}>{l.source ?? "HERMES_BACKEND"}</span>: {l.message}
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest" style={{ color: "var(--hx-dim)" }}>
        Times from backend Time Engine. Missing → UNKNOWN. Browser clock not used.
      </div>
    </Panel>
  );
}

/* ============================================================================
 * Symbol Workspace (chart) shown above tab content when relevant
 * ========================================================================== */

function SymbolWorkspace({ symbol }: { symbol: SymbolKey }) {
  const sym = SYMBOL_MAP[symbol];
  const h = useBackendHealth();
  return (
    <Panel
      title={`${sym} · WORKSPACE`}
      right={
        <span className="flex items-center gap-2">
          <span
            className="inline-block hx-pulse"
            style={{ width: 6, height: 6, background: h.tradeReady ? "var(--hx-buy)" : "var(--hx-warn)" }}
          />
          <span style={{ color: h.tradeReady ? "var(--hx-buy)" : "var(--hx-warn)" }}>
            {h.tradeReady ? "LIVE" : h.offline ? "OFFLINE" : "STALE"}
          </span>
        </span>
      }
    >
      <ConfirmationRibbon />
      <div className="relative mt-1">
        <QuantChartLabel />
        <CandleChart variant="main" />
      </div>
    </Panel>
  );
}

/* ============================================================================
 * Dashboard shell
 * ========================================================================== */

function Dashboard() {
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [symbol, setSymbol] = useState<SymbolKey>("BTC");

  const content = useMemo(() => {
    switch (tab) {
      case "OVERVIEW": return <TabOverview symbol={symbol} />;
      case "ORDER FLOW": return <TabOrderFlow symbol={symbol} />;
      case "STRATEGIES": return <TabStrategies symbol={symbol} />;
      case "INTELLIGENCE": return <TabIntelligence />;
      case "JOURNAL": return <TabJournal />;
      case "AUDIT": return <TabAudit symbol={symbol} />;
      case "LOGS": return <TabLogs />;
    }
  }, [tab, symbol]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--hx-bg)", color: "var(--hx-txt)", fontFamily: "Archivo" }}
    >
      <TopBar symbol={symbol} onSymbol={setSymbol} />
      <SafetyStrip />
      <BackendHealthBar />
      <TabsNav tab={tab} onTab={setTab} />

      <main className="flex-1 p-3 overflow-x-auto" style={{ minWidth: 1080 }}>
        {tab !== "LOGS" && tab !== "AUDIT" && tab !== "JOURNAL" && (
          <div className="mb-3"><SymbolWorkspace symbol={symbol} /></div>
        )}
        {content}
      </main>

      <CvdStrip symbolKey={symbol} />

      <footer
        className="px-3 py-2 text-[10px] uppercase tracking-widest border-t flex justify-between"
        style={{ background: "var(--hx-panel)", borderColor: "var(--hx-border)", color: "var(--hx-dim)" }}
      >
        <span>HERMES TERMINAL · BUILD 0.3.0 · DEMO PILOT</span>
        <span>DASHBOARD IS READ-ONLY · EXECUTION ONLY FROM BACKEND DEMO ROUTER · LIVE TRADING BLOCKED</span>
      </footer>
    </div>
  );
}
