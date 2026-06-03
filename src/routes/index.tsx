import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, KV } from "@/components/dashboard/Panel";
import { CandleChart } from "@/components/dashboard/CandleChart";

import { Waiting } from "@/components/dashboard/Waiting";
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
import { QuantStrategyPanel, QuantProStrategyPanel, ConfirmationRibbon, QuantChartLabel, StrategyCountCard } from "@/components/dashboard/QuantStrategy";
import { WspChartWorkspace } from "@/components/dashboard/WspIntelligence";
import { TimeframeHierarchyPanel } from "@/components/dashboard/TimeframeHierarchy";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { useEffect, useState } from "react";

function HeartbeatIndicator() {
  const ds = useDashboardStatusPayload();
  const rt = useRealtimeStatus();
  const hb = ds.utc_time ?? ds.updated_at ?? ds.last_heartbeat ?? null;
  const hbDate = hb ? new Date(String(hb).replace(" ", "T")) : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);
  const ageSec = hbDate && !isNaN(hbDate.getTime()) ? Math.max(0, Math.floor((now - hbDate.getTime()) / 1000)) : null;
  const tone =
    ageSec == null ? "opacity-60" : ageSec > 60 ? "text-loss" : ageSec > 15 ? "text-orange-700" : "text-profit";
  const warn = ageSec == null ? null : ageSec > 60 ? "BACKEND STALE / CHECK RDP" : ageSec > 15 ? "DATA STALE" : null;
  const rtTone = rt === "CONNECTED" ? "text-profit" : rt === "RECONNECTING" ? "text-orange-700" : "text-loss";
  const rtLabel = rt === "CONNECTED" ? "LIVE: CONNECTED" : rt === "RECONNECTING" ? "LIVE: RECONNECTING" : "LIVE: OFFLINE — FALLBACK POLLING";
  return (
    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest flex-wrap">
      <span className={`${rtTone} font-bold`}>{rtLabel}</span>
      <span className="opacity-50">|</span>
      <span className="opacity-70">HB:</span>
      <b>{hb ? String(hb).slice(11, 19) || String(hb) : "—"}</b>
      <span className="opacity-50">|</span>
      <span className={tone}>AGE: {ageSec == null ? "—" : `${ageSec}s`}</span>
      {warn && <span className={`px-1 border ${ageSec! > 60 ? "border-loss text-loss" : "border-orange-700 text-orange-700"} font-bold`}>{warn}</span>}
    </span>
  );
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function StatusDot({ ok = true, label }: { ok?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2 h-2 border border-black"
        style={{ background: ok ? "black" : "transparent" }}
      />
      {label}
    </span>
  );
}

function HeaderBackendTime() {
  const t = useBackendTime();
  const cell = (label: string, v: string | null) => (
    <div className="flex items-center justify-between gap-2">
      <span className="opacity-70">{label}</span>
      <b className={v ? "" : "opacity-60"}>{v ?? "UNKNOWN"}</b>
    </div>
  );
  const gateTone = t.gate_status?.toUpperCase() === "PASS" || t.gate_status?.toUpperCase() === "OPEN"
    ? "text-profit"
    : t.gate_status?.toUpperCase() === "BLOCK" || t.gate_status?.toUpperCase() === "CLOSED"
    ? "text-loss"
    : "opacity-70";
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
      {cell("UTC", t.utc)}
      {cell("CASA", t.casa)}
      {cell("BRK", t.broker)}
      {cell("SESS", t.session)}
      <div className="flex items-center justify-between gap-2 col-span-2">
        <span className="opacity-70">GATE</span>
        <b className={gateTone}>{t.gate_status ?? "UNKNOWN"}</b>
      </div>
      <div className="col-span-2 truncate opacity-80" title={t.gate_reason ?? ""}>
        <span className="opacity-70">REASON:</span> {t.gate_reason ?? "UNKNOWN"}
      </div>
    </div>
  );
}

function Header() {
  const ds = useDashboardStatusPayload();
  const { rows: statuses } = useLiveTable<any>("bot_status", { orderBy: "component", ascending: true, limit: 20 });
  const byKey: Record<string, any> = {};
  statuses.forEach((s) => (byKey[s.component] = s));
  const rdp = byKey["RDP"]?.status ?? "—";
  const mt5Component = byKey["MT5"]?.status;
  const mt5Connected = ds.mt5_connected;
  const mt5 = mt5Component ?? (mt5Connected == null ? "—" : mt5Connected ? "CONNECTED" : "DISCONNECTED");
  const bot = byKey["HERMES"]?.status ?? (statuses.length ? "ONLINE" : "WAITING");

  const modeRaw = ds.mode;
  const headerMode = modeRaw
    ? `READ ONLY · ${String(modeRaw).replace(/_/g, " ").toUpperCase()}`
    : "READ ONLY · DEMO PILOT";

  return (
    <header className="panel border-b-2">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-4 border-r border-black p-3">
          <div className="text-[22px] font-black tracking-tight leading-none">
            MT5 <span className="opacity-60">×</span> HERMES
          </div>
          <div className="text-[10px] mt-1.5 uppercase tracking-wider opacity-80">
            BTCUSD / XAUUSD / EURUSD
          </div>
          <div className="text-[10px] uppercase tracking-wider opacity-80">
            5-MIN AI TRADING AGENT
          </div>
        </div>
        <div className="col-span-4 border-r border-black p-3 flex items-center justify-center">
          <div className="text-[11px] tracking-[0.25em] uppercase font-bold text-center">
            MARKOV · KELLY · SELF-LEARN · RISK · EXECUTION
          </div>
        </div>
        <div className="col-span-4 p-3 text-[10px] uppercase tracking-wider grid grid-cols-2 gap-x-3 gap-y-1">
          <div>BOT STATUS: <b>{bot}</b><span className="blink ml-1">_</span></div>
          <div>MODE: <b>{headerMode}</b></div>
          <div>RDP: <b>{rdp}</b></div>
          <div>MT5: <b>{mt5}</b></div>

          <div className="col-span-2 border-t border-dashed border-black/40 pt-1 mt-0.5">
            <HeaderBackendTime />
          </div>
        </div>
      </div>
      <nav className="border-t border-black flex text-[10px] uppercase tracking-widest">
        {[
          { to: "/", label: "Command Center" },
          { to: "/settings", label: "Settings" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="px-3 py-1.5 border-r border-black hover:bg-foreground hover:text-background"
            activeProps={{ className: "px-3 py-1.5 border-r border-black bg-foreground text-background" }}
          >
            {l.label}
          </Link>
        ))}
        <div className="ml-auto px-3 py-1.5 flex items-center gap-4">
          <HeartbeatIndicator />
          <StatusDot label="SUPABASE: LIVE" />
          <span>v0.2.0 — HERMES</span>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  const ds = useDashboardStatusPayload();
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 500 });
  const s = snaps[0] ?? {};
  const acctType = String(ds.account_type ?? "").toUpperCase();
  const isDemo = acctType === "DEMO";
  const acctLabel =
    acctType === "DEMO" ? "ACCT: DEMO VERIFIED" :
    acctType === "LIVE" ? "ACCT: LIVE" :
    "ACCT: UNKNOWN";

  // Demo-only datasets (single source of truth = trades table, magic 909002)
  const demoTrades = trades.filter((t: any) => Number(t.magic_number ?? t.magic) === 909002);
  const openDemoTrades = demoTrades.filter((t: any) =>
    String(t.result ?? "").toUpperCase() === "OPEN" && t.closed_at == null
  );
  const closedDemoTrades = demoTrades.filter((t: any) =>
    String(t.result ?? "").toUpperCase() === "CLOSED" || t.closed_at != null
  );
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: any) => typeof d === "string" && d.slice(0, 10) === today;
  const openedToday = demoTrades.filter((t: any) => isToday(t.opened_at ?? t.created_at)).length;
  const closedToday = closedDemoTrades.filter((t: any) => isToday(t.closed_at)).length;
  // Single source of truth for demo PnL = sum of closed demo trades closed TODAY
  // (this matches DemoReport's "PnL Today").
  const demoPnlTodayCalc = closedDemoTrades
    .filter((t: any) => isToday(t.closed_at))
    .reduce((acc: number, t: any) => acc + Number(t.pnl ?? 0), 0);
  const wins = closedDemoTrades.filter((t: any) => Number(t.pnl ?? 0) > 0).length;
  const losses = closedDemoTrades.filter((t: any) => Number(t.pnl ?? 0) < 0).length;
  const demoWinRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;

  const totalPnlNum = isDemo
    ? Number(demoPnlTodayCalc)
    : Number(s.total_pnl ?? 0);
  const totalPnlSource = isDemo
    ? "Demo PnL Today — HERMES magic 909002"
    : "Verified from MT5";
  const accountStatusLabel = isDemo
    ? "Account: DEMO VERIFIED"
    : acctType === "LIVE" ? "Account: LIVE" : "Account: UNKNOWN";

  const winRateDisplay = isDemo
    ? (demoWinRate ?? "—")
    : (s.win_rate ?? 0);
  const tradesTodayDisplay = isDemo
    ? openedToday
    : (s.trades_today ?? "—");
  // Open positions MUST match Open Demo table source of truth.
  const openPosDisplay = isDemo
    ? openDemoTrades.length
    : (s.open_positions ?? 0);
  const dailyPnlDisplay = isDemo
    ? Number(demoPnlTodayCalc)
    : Number(s.daily_pnl ?? 0);

  return (
    <Panel title={isDemo ? "TOTAL PNL — VERIFIED FROM HERMES DEMO" : "TOTAL PNL — VERIFIED FROM MT5"} right={acctLabel} className="col-span-8">
      <div className="grid grid-cols-3 gap-3 items-center">
        <div className="col-span-2 px-2 py-3">
          <div className="text-[10px] uppercase opacity-70 tracking-widest">Total PnL</div>
          <div className={`pixel text-[88px] leading-none tracking-tighter ${totalPnlNum >= 0 ? "text-profit" : "text-loss"}`}>
            {totalPnlNum >= 0 ? "+" : ""}${Math.abs(totalPnlNum).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] uppercase tracking-widest flex-wrap">
            <StatusDot label={totalPnlSource} />
            <StatusDot label={accountStatusLabel} />
            <StatusDot label="Broker Connected" />
            <Badge
              value={isDemo ? "DEMO PILOT READ-ONLY — NO LIVE EXECUTION" : "LIVE ACCOUNT READ-ONLY — PAPER EXECUTION ONLY"}
              tone="orange"
            />
          </div>
        </div>
        <div className="border-l border-black p-2 space-y-0.5">
          <KV k="Trades Today" v={isDemo ? `${tradesTodayDisplay} opened / ${closedToday} closed` : tradesTodayDisplay} />
          <KV k="Daily PnL" v={`${dailyPnlDisplay >= 0 ? "+" : ""}$${dailyPnlDisplay.toFixed(2)}`} accent={dailyPnlDisplay >= 0 ? "profit" : "loss"} />
          <KV k="Win Rate" v={winRateDisplay === "—" ? "—" : `${winRateDisplay}%`} />
          <KV k="Profit Factor" v={s.profit_factor ?? "—"} />
          <KV k="Open Positions" v={openPosDisplay} />
          <KV k="Max DD" v={`${s.max_drawdown ?? 0}%`} accent="loss" />
        </div>
      </div>
    </Panel>
  );
}

function MetricsRow() {
  const ds = useDashboardStatusPayload();
  const { rows, empty } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 500 });
  const s = rows[0] ?? {};
  const acctType = String(ds.account_type ?? "").toUpperCase();
  const isDemo = acctType === "DEMO";

  if (!isDemo && (empty || !rows[0])) {
    return <div className="border border-black -mt-px p-2"><Waiting label="WAITING FOR HERMES LIVE METRICS" /></div>;
  }

  // Demo-aware aggregates from trades table
  const demoTrades = trades.filter((t: any) => Number(t.magic_number ?? t.magic) === 909002);
  const closedDemo = demoTrades.filter((t: any) =>
    String(t.result ?? "").toUpperCase() === "CLOSED" || t.closed_at != null
  );
  const openDemo = demoTrades.filter((t: any) =>
    String(t.result ?? "").toUpperCase() === "OPEN" && t.closed_at == null
  );
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: any) => typeof d === "string" && d.slice(0, 10) === today;
  const openedTodayDemo = demoTrades.filter((t: any) => isToday(t.opened_at ?? t.created_at)).length;
  const demoPnl = closedDemo.reduce((a: number, t: any) => a + Number(t.pnl ?? 0), 0);
  const wins = closedDemo.filter((t: any) => Number(t.pnl ?? 0) > 0).length;
  const losses = closedDemo.filter((t: any) => Number(t.pnl ?? 0) < 0).length;
  const demoWinRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;

  const tradesToday = isDemo ? (ds.opened_today ?? openedTodayDemo) : (s.trades_today ?? 0);
  const totalTrades = isDemo ? demoTrades.length : (s.total_trades ?? 0);
  const winRate = isDemo ? (ds.demo_win_rate ?? demoWinRate ?? "—") : (s.win_rate ?? 0);
  const dailyPnl = isDemo ? Number(ds.demo_pnl_today ?? demoPnl ?? 0) : Number(s.daily_pnl ?? 0);
  const openPos = isDemo ? openDemo.length : (s.open_positions ?? 0);

  const items = [
    { k: "Trades Today", v: tradesToday },
    { k: "Total Trades", v: Number(totalTrades).toLocaleString("en-US") },
    { k: "Win Rate", v: winRate === "—" ? "—" : `${winRate}%` },
    { k: "Daily PnL", v: `${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)}`, a: (dailyPnl >= 0 ? "profit" : "loss") as "profit" | "loss" },
    { k: "Equity", v: `$${(s.equity ?? 0).toLocaleString("en-US")}` },
    { k: "Profit Factor", v: s.profit_factor ?? "—" },
    { k: "Max DD", v: `${s.max_drawdown ?? 0}%`, a: "loss" as const },
    { k: "Open Pos", v: openPos },
  ];
  return (
    <div className="grid grid-cols-8 gap-0 border border-black -mt-px">
      {items.map((it, i) => (
        <div key={i} className="p-2 border-r last:border-r-0 border-black">
          <div className="text-[9px] uppercase tracking-widest opacity-70">{it.k}</div>
          <div className={`pixel text-[22px] ${it.a === "profit" ? "text-profit" : ""} ${it.a === "loss" ? "text-loss" : ""}`}>
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
    <Panel title="MARKOV STATE TRANSITION" right={m ? `${m.symbol} ${m.timeframe}` : "—"}>
      {empty || !m ? (
        <Waiting />
      ) : (
        <>
          <div className="grid grid-cols-5 items-center gap-2 my-2">
            <div className="col-span-2 text-center">
              <div className="text-[9px] uppercase opacity-70">Current State</div>
              <div className="pixel text-[34px] leading-none">{m.current_state}</div>
            </div>
            <div className="text-center text-[28px]">→</div>
            <div className="col-span-2 text-center">
              <div className="text-[9px] uppercase opacity-70">Predicted Next</div>
              <div className="pixel text-[34px] leading-none">{m.predicted_state}</div>
            </div>
          </div>
          <div className="border-y border-dashed border-black/40 py-1 text-center">
            <span className="text-[10px] uppercase opacity-70">probability</span>{" "}
            <span className="pixel text-[18px]">p = {Number(m.probability).toFixed(2)}</span>{" "}
            <span className="ml-3 px-1.5 border border-black text-[10px]">SIGNAL: {m.signal ?? "—"}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div><div className="text-[9px] uppercase opacity-70">Persistence</div><div className="pixel text-[16px]">{m.persistence_bars ?? "—"}</div></div>
            <div><div className="text-[9px] uppercase opacity-70">Transitions</div><div className="pixel text-[16px]">{m.transitions ?? "—"}</div></div>
            <div><div className="text-[9px] uppercase opacity-70">Signal</div><div className="pixel text-[16px]">{m.signal ?? "—"}</div></div>
          </div>
        </>
      )}
    </Panel>
  );
}

function Kelly() {
  const { rows, empty } = useLiveTable<any>("kelly_risk", { limit: 1 });
  const k = rows[0];
  return (
    <Panel title="KELLY RISK ENGINE" right="f* = p−(1−p)/b">
      {empty || !k ? (
        <Waiting />
      ) : (
        (() => {
          const raw = (k.raw_payload ?? {}) as Record<string, any>;
          const riskStatus = (k.risk_status ?? k.status ?? raw.risk_status ?? raw.status ?? "—") as string;
          const isBlocked = String(riskStatus).toUpperCase() === "BLOCKED";
          const rawLot = Number(raw.raw_lot ?? raw.calculated_lot ?? k.lot_size ?? 0);
          const executableLot = isBlocked ? 0 : Number(k.lot_size ?? 0);
          const finalRisk = isBlocked ? 0 : Number(k.final_risk ?? 0);
          const blockedReason = k.blocked_reason ?? raw.blocked_reason ?? "—";
          return (
            <>
              <div className="border border-dashed border-black/50 p-2 text-center my-1">
                <span className="pixel text-[14px]">Kelly f* = p − (1−p) / b</span>
              </div>
              <KV k="Model Probability" v={Number(k.model_probability ?? 0).toFixed(2)} />
              <KV k="Reward / Risk" v={Number(k.reward_risk ?? 0).toFixed(1)} />
              <KV k="Edge" v={`${k.edge ?? 0}%`} />
              <KV k="Fractional Kelly" v={Number(k.kelly_fraction ?? 0).toFixed(2)} />
              <KV k="Final Risk" v={`${finalRisk}%`} />
              <KV k="Lot Size" v={executableLot.toFixed(2)} />
              <KV k="Raw Lot" v={rawLot.toFixed(2)} />
              {isBlocked && (
                <KV k="Theoretical Raw Lot" v={Number(raw.raw_lot ?? raw.calculated_lot ?? 0).toFixed(2)} />
              )}
              <div className="mt-2 border border-black px-2 py-1 text-center bg-foreground text-background text-[11px] tracking-widest">
                RISK STATUS: {riskStatus}
              </div>
              {isBlocked && (
                <div className="mt-1 text-[10px] opacity-80">
                  <b>BLOCKED:</b> {blockedReason}
                </div>
              )}
            </>
          );
        })()
      )}
    </Panel>
  );
}

function Decision() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = ((d?.raw_payload ?? {}) as any);
  const inner = (rp?.raw_payload ?? {}) as any;
  const merged = { ...rp, ...inner };
  const finalCap = merged.final_capped_lot ?? merged.demo_capped_lot ?? merged.gate_statuses?.final_lot;
  const executableLot = finalCap != null ? Math.min(Number(finalCap), 0.01) : null;
  const rawLot = merged.raw_lot ?? merged.calculated_lot ?? merged.kelly_suggested_lot ?? d?.lot_size;
  return (
    <Panel title="AI DECISION OBJECT" right="LATEST BACKEND DECISION">
      {empty || !d ? (
        <Waiting />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <KV k="Symbol" v={d.symbol ?? "—"} />
            <KV k="Timeframe" v={d.timeframe ?? "—"} />
            <KV k="Market State" v={d.market_state ?? "—"} />
            <KV k="Markov p" v={Number(d.markov_probability ?? 0).toFixed(2)} />
            <KV k="Strategy" v={d.strategy ?? "—"} />
            <KV k="Signal" v={d.signal ?? "—"} accent="profit" />
            <KV k="Confidence" v={`${d.confidence ?? 0}%`} />
            <KV k="Risk Status" v={d.risk_status ?? "—"} />
            <KV k="Raw Lot" v={rawLot != null ? Number(rawLot).toFixed(4) : "—"} />
            <KV k="Executable Lot" v={executableLot != null ? executableLot.toFixed(4) : "0.0100"} accent="profit" />
            <KV k="Max Lot Cap" v="0.0100" />
            <KV k="Entry" v={d.entry ?? "—"} />
            <KV k="SL" v={d.sl ?? "—"} accent="loss" />
            <KV k="TP" v={d.tp ?? "—"} accent="profit" />
          </div>
          <div className="mt-2 border-t border-black pt-1.5">
            <div className="text-[9px] uppercase opacity-70">Decision</div>
            <div className="pixel text-[20px]">{d.decision ?? "—"}</div>
            <div className="text-[10px] mt-1 opacity-80"><b>REASON:</b> {d.reason ?? "—"}</div>
            <div className="text-[10px] opacity-80"><b>BLOCKED:</b> {d.blocked_reason ?? "None"}</div>
            <div className="text-[10px] opacity-70 mt-1 italic">⚠ Raw Lot is theoretical only. Executable Lot = backend final_capped_lot (≤ 0.01).</div>
          </div>
        </>
      )}
    </Panel>
  );
}

function TopDownReader() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const ds = useDashboardStatusPayload();
  const d = rows[0];
  const rp = ((d?.raw_payload ?? {}) as any);
  const inner = (rp?.raw_payload ?? {}) as any;
  const latest = (rp?.latest_decision ?? ds?.latest_decision ?? {}) as any;
  const m = { ...ds, ...rp, ...inner, ...latest };

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = m?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const status = pick("top_down_status");
  const decision = pick("top_down_decision");
  const score = pick("entry_readiness_score", "readiness_score");
  const narrative = pick("market_narrative", "narrative");
  const missingRaw = pick("missing_confirmations");
  const breakdown = (pick("score_breakdown") ?? {}) as Record<string, any>;

  const hasAny =
    status != null || decision != null || score != null || narrative != null ||
    missingRaw != null || Object.keys(breakdown).length > 0;

  const missing: string[] = Array.isArray(missingRaw)
    ? missingRaw.map(String)
    : typeof missingRaw === "string"
      ? missingRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];

  const statusToneVal = (() => {
    const v = String(status ?? "").toUpperCase();
    if (v === "PASS") return "green" as const;
    if (v === "WAIT") return "orange" as const;
    if (v === "FAIL") return "red" as const;
    return "gray" as const;
  })();
  const decisionToneVal = (() => {
    const v = String(decision ?? "").toUpperCase();
    if (v === "ALLOW_DEMO") return "green" as const;
    if (v === "WAIT_FOR_CONFIRMATION") return "orange" as const;
    if (v === "AVOID") return "red" as const;
    return "gray" as const;
  })();

  const breakdownRows: Array<{ k: string; label: string }> = [
    { k: "htf_alignment", label: "HTF Alignment" },
    { k: "price_location", label: "Price Location" },
    { k: "liquidity_sweep", label: "Liquidity Sweep" },
    { k: "bos_choch", label: "BOS / CHoCH" },
    { k: "ob_fvg", label: "OB / FVG" },
    { k: "m15", label: "M15" },
    { k: "m5", label: "M5" },
    { k: "m1", label: "M1" },
    { k: "rr", label: "RR" },
    { k: "spread", label: "Spread" },
  ];

  const fmtBreak = (key: string) => {
    const v =
      breakdown?.[key] ??
      breakdown?.[key.toUpperCase()] ??
      breakdown?.[key.replace(/_/g, " ")] ??
      breakdown?.[key.replace(/_/g, "-")];
    if (v === undefined || v === null || v === "") return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <Panel title="TOP-DOWN MARKET READER" right="LATEST · READ-ONLY">
      {!hasAny ? (
        <div className="text-[11px] italic opacity-80 p-2">Waiting for top-down reader data</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="border border-black p-1.5">
              <div className="text-[9px] uppercase opacity-70">Status</div>
              <Badge value={String(status ?? "—").toUpperCase()} tone={statusToneVal} />
            </div>
            <div className="border border-black p-1.5">
              <div className="text-[9px] uppercase opacity-70">Decision</div>
              <Badge value={String(decision ?? "—").toUpperCase()} tone={decisionToneVal} />
            </div>
            <div className="border border-black p-1.5">
              <div className="text-[9px] uppercase opacity-70">Readiness</div>
              <div className="pixel text-[16px]">{score != null ? `${score}/100` : "—"}</div>
            </div>
          </div>

          <div className="mt-2 border-t border-black pt-1.5">
            <div className="text-[9px] uppercase opacity-70">Narrative</div>
            <div className="text-[11px] mt-0.5">
              {narrative ? String(narrative) : <span className="italic opacity-70">Waiting for top-down reader data</span>}
            </div>
          </div>

          <div className="mt-2 border-t border-black pt-1.5">
            <div className="text-[9px] uppercase opacity-70 mb-1">Missing Confirmations</div>
            {missing.length === 0 ? (
              <div className="text-[10px] opacity-70 italic">None</div>
            ) : (
              <ul className="text-[10px] list-disc pl-4 space-y-0.5">
                {missing.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            )}
          </div>

          <div className="mt-2 border-t border-black pt-1.5">
            <div className="text-[9px] uppercase opacity-70 mb-1">Score Breakdown</div>
            <div className="grid grid-cols-2 gap-x-3">
              {breakdownRows.map((r) => (
                <KV key={r.k} k={r.label} v={fmtBreak(r.k)} />
              ))}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function Strategies() {
  const { rows, empty } = useLiveTable<any>("strategy_signals", { limit: 8 });
  // collapse to latest per strategy
  const seen = new Set<string>();
  const latest = rows.filter((r) => (seen.has(r.strategy) ? false : (seen.add(r.strategy), true))).slice(0, 4);
  return (
    <Panel title="STRATEGY MODULES" right={`${latest.length} loaded`}>
      {empty || latest.length === 0 ? (
        <Waiting />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {latest.map((s) => (
            <div key={s.id} className="border border-black p-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[11px]">{s.strategy}</div>
                <div className="text-[9px] border border-black px-1">{s.status ?? "—"}</div>
              </div>
              <div className="mt-1.5 space-y-0.5">
                <KV k="Signal" v={s.signal ?? "—"} />
                <KV k="Confidence" v={`${s.confidence ?? 0}%`} />
                <KV k="Win Rate" v={`${s.win_rate ?? 0}%`} />
                <KV k="Today PnL" v={`${(s.pnl ?? 0) >= 0 ? "+" : ""}$${Number(s.pnl ?? 0).toFixed(2)}`} accent={(s.pnl ?? 0) >= 0 ? "profit" : "loss"} />
              </div>
              {s.reason && <div className="mt-1 text-[10px] opacity-80 italic line-clamp-2">"{s.reason}"</div>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SkipEngine() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 20 });
  const skipped = rows.filter((r) => (r.decision ?? "").toUpperCase() === "SKIP").slice(0, 6);
  return (
    <Panel title="SIGNAL SKIP ENGINE" right={`SKIPPED: ${skipped.length}`}>
      {empty || skipped.length === 0 ? (
        <Waiting />
      ) : (
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-black text-left uppercase tracking-wider">
              <th className="py-1">Time</th><th>Symbol</th><th>Strategy</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {skipped.map((s) => (
              <tr key={s.id} className="border-b border-dashed border-black/40">
                <td className="py-1 pixel">{new Date(s.created_at).toISOString().slice(11, 19)}</td>
                <td>{s.symbol}</td>
                <td>{s.strategy}</td>
                <td className="text-loss">{s.blocked_reason ?? s.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Stack() {
  const { rows, empty } = useLiveTable<any>("bot_status", { orderBy: "component", ascending: true, limit: 10 });
  return (
    <Panel title="TRADING STACK" right={`${rows.length} NODES`}>
      {empty ? (
        <Waiting />
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {rows.slice(0, 5).map((n) => (
            <div key={n.id} className="border border-black p-2">
              <div className="font-bold text-[11px]">{n.component}</div>
              <div className="text-[9px] opacity-70 leading-tight mt-0.5">{n.meta?.desc ?? ""}</div>
              <div className="mt-1.5 space-y-0.5">
                <KV k="Uptime" v={n.uptime ?? "—"} />
                <KV k="Health" v={n.status ?? "—"} accent="profit" />
                <KV k="Latency" v={n.latency_ms != null ? `${n.latency_ms}ms` : "—"} />
                <KV k="Status" v={n.status ?? "—"} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SelfLearn() {
  const { rows, empty } = useLiveTable<any>("nightly_reports", { orderBy: "report_date", ascending: false, limit: 1 });
  const r = rows[0];
  const p = (r?.payload ?? r?.raw_payload ?? {}) as Record<string, any>;
                const u = (v: any) => (v == null || v === "" ? "WAITING FOR NIGHTLY REPORT" : v);
  return (
    <Panel title="SELF-LEARNING NIGHTLY LOOP" right="03:00 UTC">
      {empty || !r ? (
        <Waiting label="WAITING FOR NEW REPORT DATA" />
      ) : (
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
            <div key={s.n} className={`p-2 ${i % 4 !== 3 ? "border-r border-dashed border-black/50" : ""} ${i < 4 ? "border-b border-dashed border-black/50" : ""}`}>
              <div className="pixel text-[22px] leading-none">{s.n}</div>
              <div className="font-bold text-[11px] mt-1">{s.t}</div>
              <div className="text-[10px] opacity-80 mt-1 leading-snug">{s.d}</div>
            </div>
          ))}
          <div className="col-span-4 p-2 border-t border-dashed border-black/50">
            <div className="text-[10px] uppercase opacity-70">Suggestion</div>
            <div className="text-[11px] italic">▶ {u(r.suggestion ?? p.suggestion)}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Telegram() {
  const { rows: reports, empty: noReports } = useLiveTable<any>("nightly_reports", { orderBy: "report_date", ascending: false, limit: 1 });
  const { rows: execs, empty: noExecs } = useLiveTable<any>("execution_events", { limit: 1 });
  const r = reports[0];
  const e = execs[0];
  return (
    <Panel title="TELEGRAM REPORT" right="@HERMES_BOT">
      {noReports && noExecs ? (
        <Waiting />
      ) : (
        <>
          <div className="border border-black p-2 bg-secondary">
            <div className="flex items-center justify-between border-b border-dashed border-black/50 pb-1 mb-1">
              <b>HERMES TRADING BOT</b>
              <span className="text-[10px] border border-black px-1">ONLINE</span>
            </div>
            <div className="text-[10px] uppercase opacity-70 mt-1">Nightly Report</div>
            {r ? (
              (() => {
                const p = (r.payload ?? r.raw_payload ?? {}) as Record<string, any>;
                const u = (v: any) => (v == null || v === "" ? "WAITING FOR NIGHTLY REPORT" : v);
                return (
                  <>
                    <KV k="Trades" v={u(r.trades_reviewed)} />
                    <KV k="Best Setup" v={u(r.best_setup ?? p.best_setup)} />
                    <KV k="Worst Setup" v={u(r.worst_setup ?? p.worst_setup)} accent="loss" />
                    <KV k="Best Strategy" v={u(p.best_strategy)} />
                    <KV k="Worst Strategy" v={u(p.worst_strategy)} accent="loss" />
                    <KV k="Best Session" v={u(r.best_session ?? p.best_session)} />
                    <KV k="Worst Session" v={u(p.worst_session)} accent="loss" />
                    <KV k="Safety Blocks" v={u(p.safety_guard_blocks)} />
                    <KV k="Big Setup Grades" v={
                      p.big_setup_grade_summary && typeof p.big_setup_grade_summary === "object"
                        ? Object.entries(p.big_setup_grade_summary).map(([g, n]) => `${g}:${n}`).join(" ")
                        : "WAITING FOR NIGHTLY REPORT"
                    } />
                    <div className="text-[10px] mt-1 opacity-80 italic">▶ {u(r.suggestion ?? p.suggestion)}</div>
                  </>
                );
              })()
            ) : (
              <Waiting label="NO NIGHTLY REPORT YET" />
            )}
          </div>
          <div className="mt-2 border border-black p-2">
            <div className="text-[10px] uppercase opacity-70">Latest Alert</div>
            {e ? (
              <>
                <div className="pixel text-[14px]">{(e.result ?? "—")} · {e.symbol ?? "—"} · {e.side ?? "—"}</div>
                <div className="grid grid-cols-2 gap-x-3 mt-1">
                  <KV k="Price" v={e.price ?? "—"} />
                  <KV k="Lot" v={e.lot ?? "—"} />
                  <KV k="Mode" v={e.mode ?? "READ_ONLY"} />
                  <KV k="Magic" v={e.magic ?? "—"} />
                </div>
              </>
            ) : (
              <Waiting label="NO EXECUTION EVENTS" />
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

function VideoAgents() {
  const { rows, empty } = useLiveTable<any>("hermes_agents", { orderBy: "name", ascending: true, limit: 12 });
  return (
    <Panel title="VIDEO AGENTS" right={`${rows.length} ONLINE`}>
      {empty ? (
        <Waiting />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {rows.map((a) => (
            <div key={a.id} className="border border-black p-2">
              <div className="flex items-center justify-between border-b border-dashed border-black/50 pb-1">
                <b className="text-[11px]">{a.name}</b>
                <span className="text-[9px] border border-black px-1">{a.tag ?? "—"}</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {a.symbol && <KV k="Symbol" v={a.symbol} />}
                {a.timeframe && <KV k="Timeframe" v={a.timeframe} />}
                {a.latest_signal && <KV k="Latest Signal" v={a.latest_signal} />}
                {a.confidence != null && <KV k="Confidence" v={`${a.confidence}%`} />}
                {a.pnl_today != null && <KV k="PnL Today" v={`${a.pnl_today >= 0 ? "+" : ""}$${a.pnl_today}`} accent={a.pnl_today >= 0 ? "profit" : "loss"} />}
              </div>
              <div className="mt-1.5 border border-black bg-foreground text-background text-[10px] tracking-widest text-center py-0.5">
                {a.status ?? "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Journal() {
  const { rows, empty } = useLiveTable<any>("trades", { limit: 50 });

  const isClosed = (t: any) => {
    const rp = t.raw_payload || {};
    const inner = rp.raw_payload || {};
    const status = String(rp.status ?? inner.status ?? "").toUpperCase();
    const result = String(t.result ?? "").toUpperCase();
    return (
      t.closed_at != null ||
      result === "WIN" ||
      result === "LOSS" ||
      (t.pnl != null && Number(t.pnl) !== 0) ||
      status === "CLOSED"
    );
  };

  const tradeKey = (t: any): string => {
    if (t.ticket != null) return `tk:${t.ticket}`;
    const rp = t.raw_payload || {};
    const inner = rp.raw_payload || {};
    const pid = rp.paper_trade_id ?? inner.paper_trade_id;
    if (pid) return `pid:${pid}`;
    return `fb:${t.symbol}|${t.dir}|${t.entry}|${t.opened_at ?? ""}`;
  };

  const valid = rows.filter(
    (t: any) => t.symbol && t.dir && t.entry != null && (t.lot_size ?? t.lot) != null,
  );

  const byKey = new Map<string, any>();
  for (const t of valid) {
    const key = tradeKey(t);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, t);
      continue;
    }
    const existingClosed = isClosed(existing);
    const tClosed = isClosed(t);
    if (tClosed && !existingClosed) byKey.set(key, t);
    else if (tClosed === existingClosed) {
      const a = new Date(t.closed_at ?? t.opened_at ?? t.created_at).getTime();
      const b = new Date(existing.closed_at ?? existing.opened_at ?? existing.created_at).getTime();
      if (a > b) byKey.set(key, t);
    }
  }

  const deduped = Array.from(byKey.values()).sort((a, b) => {
    const ta = new Date(a.opened_at ?? a.created_at).getTime();
    const tb = new Date(b.opened_at ?? b.created_at).getTime();
    return tb - ta;
  }).slice(0, 20);

  return (
    <Panel title="TRADE JOURNAL" right={`${deduped.length} ROWS`}>
      {empty || deduped.length === 0 ? (
        <Waiting />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black text-left uppercase tracking-wider">
                {["Time","Magic","Sym","Dir","Entry","SL","TP","Lot","PnL","Result","Strategy","Conf","Setup","Safety","SMC","Risk","Status","Reason"].map((h) => (
                  <th key={h} className="py-1 pr-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deduped.map((t) => {
                const rp = (t.raw_payload ?? {}) as Record<string, any>;
                const grade = rp.big_setup_grade ?? "UNKNOWN";
                const safety = rp.safety_guard_status ?? "UNKNOWN";
                const smc = rp.smc_confluence_status ?? "UNKNOWN";
                const risk = rp.risk_diag_status ?? rp.risk_status ?? "UNKNOWN";
                const sstat = rp.strategy_status ?? "UNKNOWN";
                return (
                  <tr key={t.id} className="border-b border-dashed border-black/40">
                    <td className="py-1 pr-2 pixel">{new Date(t.opened_at ?? t.created_at).toISOString().slice(11, 19)}</td>
                    <td className="pr-2">{t.magic ?? t.magic_number ?? "—"}</td>
                    <td className="pr-2">{t.symbol}</td>
                    <td className="pr-2">{t.dir}</td>
                    <td className="pr-2 pixel">{t.entry ?? "—"}</td>
                    <td className="pr-2 pixel text-loss">{t.sl ?? "—"}</td>
                    <td className="pr-2 pixel text-profit">{t.tp ?? "—"}</td>
                    <td className="pr-2">{t.lot ?? t.lot_size ?? "—"}</td>
                    <td className={`pr-2 pixel ${(t.pnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>{(t.pnl ?? 0) >= 0 ? "+" : ""}{t.pnl ?? 0}</td>
                    <td className="pr-2">{t.result ?? "—"}</td>
                    <td className="pr-2">{t.strategy ?? "—"}</td>
                    <td className="pr-2">{t.confidence != null ? `${t.confidence}%` : "—"}</td>
                    <td className="pr-2"><Badge value={grade} tone={gradeTone(grade)} /></td>
                    <td className="pr-2"><Badge value={safety} tone={statusTone(safety)} /></td>
                    <td className="pr-2"><Badge value={smc} tone={statusTone(smc)} /></td>
                    <td className="pr-2"><Badge value={risk} tone={statusTone(risk)} /></td>
                    <td className="pr-2"><Badge value={sstat} tone={String(sstat).toUpperCase() === "LEGACY_OBSERVER" ? "gray" : statusTone(sstat)} /></td>
                    <td className="pr-2 italic opacity-80">{t.reason ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  const { rows, empty } = useLiveTable<any>("bot_logs", { orderBy: "created_at", ascending: false, limit: 50 });
  const ds = useDashboardStatusPayload();
  const [showHistorical, setShowHistorical] = useState(false);
  const pilotStartedAt = ds?.pilot_started_at ?? ds?.demo_pilot_started_at ?? null;
  const pilotStartMs = pilotStartedAt ? Date.parse(pilotStartedAt) : NaN;
  const headerTs = ds?.updated_at ?? ds?.utc_time ?? null;

  const filtered = !showHistorical && !isNaN(pilotStartMs)
    ? rows.filter((l: any) => {
        const t = Date.parse(l.created_at);
        return isNaN(t) || t >= pilotStartMs;
      })
    : rows;
  // DESC fetch → reverse for chronological display (oldest first, newest at bottom)
  const ordered = [...filtered].reverse();
  const hiddenCount = rows.length - filtered.length;

  return (
    <Panel title="LOGS TERMINAL" right={`BACKEND TIME · ${headerTs ?? "UNKNOWN"}`}>
      <div className="flex items-center justify-between mb-1 text-[10px] uppercase tracking-widest">
        <span className="opacity-70">
          {pilotStartedAt
            ? `PILOT START: ${pilotStartedAt}`
            : "PILOT START: UNKNOWN"}
          {hiddenCount > 0 && !showHistorical && (
            <span className="ml-2 opacity-60">({hiddenCount} hidden)</span>
          )}
        </span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showHistorical}
            onChange={(e) => setShowHistorical(e.target.checked)}
            className="accent-black"
          />
          SHOW HISTORICAL LOGS
        </label>
      </div>
      <div className="bg-foreground text-background p-2 text-[10px] leading-snug font-mono max-h-[320px] overflow-auto">
        {empty || ordered.length === 0 ? (
          <div className="opacity-70">$ WAITING FOR HERMES LIVE LOGS <span className="blink">█</span></div>
        ) : (
          <>
            {ordered.map((l) => {
              const rp = l.raw_payload ?? {};
              const utc = pickTimeStr(rp, "utc_time");
              const casa = pickTimeStr(rp, "casablanca_time");
              const brk = rp.broker_time_estimate != null
                ? pickTimeStr(rp, "broker_time_estimate")
                : pickTimeStr(rp, "broker_time");
              const src = l.source ?? "HERMES_BACKEND";
              return (
                <div key={l.id}>
                  <span className="opacity-60">$</span>{" "}
                  [UTC {utc} | CASA {casa} | BRK {brk}] {src}: {l.message}
                </div>
              );
            })}
            <div><span className="opacity-60">$</span> <span className="blink">█</span></div>
          </>
        )}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest opacity-70">
        Latest 50 · Times from backend Time Engine. Missing → UNKNOWN. Browser clock not used.
      </div>
    </Panel>
  );
}

function ControlPanel() {
  const btns = [
    { label: "START MONITORING", invert: true },
    { label: "STOP MONITORING" },
    { label: "REFRESH DATA" },
    { label: "EMERGENCY VIEW ONLY" },
  ];
  return (
    <Panel title="CONTROL PANEL" right="READ-ONLY">
      <div className="grid grid-cols-4 gap-2">
        {btns.map((b) => (
          <button
            key={b.label}
            className={`border border-black py-2 text-[11px] tracking-widest font-bold uppercase ${b.invert ? "bg-foreground text-background" : "bg-background hover:bg-foreground hover:text-background"}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="mt-2 border border-dashed border-black/60 p-2 text-[10px] uppercase tracking-widest text-center">
        ⚠ This dashboard is read-only. It does not open, close, or modify trades.
      </div>
    </Panel>
  );
}

function ChartPrice() {
  const { rows } = useLiveTable<any>("market_states", { limit: 1, filter: { column: "symbol", value: "BTCUSD" } });
  const m = rows[0];
  return (
    <div className="flex items-baseline justify-between">
      <div className="pixel text-[36px] leading-none">{m?.price ? `$${Number(m.price).toLocaleString("en-US")}` : "—"}</div>
      <div className="text-profit pixel text-[14px]">{m?.state ?? "WAITING"}</div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen p-3 max-w-[1600px] mx-auto">
      <Header />

      <DemoModeBanner />

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-6"><DemoPilotStatus /></div>
        <div className="col-span-6"><DemoAlerts /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <Hero />
        <Panel title="BTCUSD / USD · 5-MIN" right="LIVE" className="col-span-4">
          <ChartPrice />
          <div className="text-[10px] uppercase opacity-70 mt-1">Mini snapshot</div>
          <div className="mt-2">
            <CandleChart />
          </div>
        </Panel>
      </div>

      <MetricsRow />

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-6"><DemoGateChecklist /></div>
        <div className="col-span-6"><KellyDemoPanel /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-3"><Markov /></div>
        <div className="col-span-3"><Kelly /></div>
        <div className="col-span-6">
          <Panel title="BTCUSD / USD · 5-MIN — MAIN CHART" right="ENTER · FILLED · EXIT">
            <ChartPrice />
            <div className="mt-1"><ConfirmationRibbon /></div>
            <div className="relative mt-1">
              <QuantChartLabel />
              <CandleChart variant="main" />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-3">
        <WspChartWorkspace />
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-7"><Decision /></div>
        <div className="col-span-5"><SafetyGuard /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-4"><StrategyCountCard /></div>
        <div className="col-span-8"><QuantProStrategyPanel /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-12"><QuantStrategyPanel /></div>
      </div>


      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-12"><TopDownReader /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-12"><TimeframeHierarchyPanel /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-6"><SmcMtfaPanel /></div>
        <div className="col-span-6"><TimeEnginePanel /></div>
      </div>

      <div className="mt-3"><SmcMap /></div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-12"><BigSetupDetector /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-12"><StrategyModules /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-5"><SkipEngine /></div>
        <div className="col-span-7"><Stack /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-8"><SelfLearn /></div>
        <div className="col-span-4 row-span-2"><Telegram /></div>
        <div className="col-span-8"><VideoAgents /></div>
      </div>

      <div className="mt-3"><TradeJournalTabs /></div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-7"><DemoReport /></div>
        <div className="col-span-5"><MissingFieldsPanel /></div>
      </div>

      <div className="mt-3"><PaperReport /></div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-7"><LogsTerminal /></div>
        <div className="col-span-5"><ControlPanel /></div>
      </div>

      <FooterRibbon />
    </div>
  );
}

function FooterRibbon() {
  const ds = useDashboardStatusPayload();
  const hrs = Number(ds.demo_pilot_hours ?? ds.pilot_hours_total ?? ds.demo_pilot_hours_total ?? 48);
  return (
    <footer className="mt-4 border-t-2 border-black pt-2 text-[10px] uppercase tracking-widest">
      <div className="bg-foreground text-background px-3 py-2 text-center font-bold tracking-widest">
        DASHBOARD IS READ-ONLY. EXECUTION CAN ONLY HAPPEN FROM BACKEND DEMO ROUTER AFTER ALL SAFETY GATES PASS. LIVE TRADING IS BLOCKED.
      </div>
      <div className="flex justify-between mt-2 opacity-80">
        <div>HERMES TRADING TERMINAL · BUILD 0.3.0 · DEMO PILOT {hrs}H</div>
        <div>© {new Date().getFullYear()} — DO NOT TRADE FROM THIS DASHBOARD</div>
      </div>
    </footer>
  );
}
