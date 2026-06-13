import * as React from "react";
import { Panel, KV, Chip, T, fmtMoney, fmtAge, ageSecFrom, useTick, FreshnessBadge, StatePanel, DataStateBadge } from "../primitives";
import { useDualHealth, useLatestSnapshot } from "../health";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";

const SYMBOLS = ["BTCUSD", "GOLD", "EURUSD", "US100Cash"] as const;
const SYMBOL_BROKER: Record<string, string> = {
  BTCUSD: "BTCUSD#",
  GOLD: "GOLD#",
  EURUSD: "EURUSD",
  US100Cash: "US100Cash#",
};

export function OverviewTab() {
  const h = useDualHealth();
  const snap = useLatestSnapshot();
  const ds: any = useDashboardStatusPayload();
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 20 });
  const { rows: trades } = useLiveTable<any>("trades", { orderBy: "opened_at", ascending: false, limit: 50 });
  const now = useTick(1000);

  const snapAge = ageSecFrom(snap?.snapshot_time ?? snap?.created_at, now);
  const balance = snap?.balance;
  const equity = snap?.equity;
  const profit = snap?.profit; // floating P&L
  const dailyPnl = snap?.daily_pnl ?? snap?.raw_payload?.daily_pnl;
  const totalPnl = snap?.total_pnl ?? snap?.raw_payload?.total_pnl;

  const openTrades = trades.filter((t) => String(t.result ?? "").toUpperCase() === "OPEN");
  const closedToday = trades.filter((t) => {
    const c = t.closed_at;
    if (!c) return false;
    const d = new Date(c);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const closedPnlToday = closedToday.reduce((acc, t) => acc + Number(t.pnl ?? 0), 0);

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Health verdict + PnL truth (mini) */}
      <Panel title="Health Verdict" className="col-span-12 lg:col-span-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim, fontFamily: "Archivo" }}>Backend</span>
            <Chip tone={h.backend === "ONLINE" ? "buy" : h.backend === "STALE" ? "warn" : "danger"}>{h.backend}</Chip>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim, fontFamily: "Archivo" }}>Ingest</span>
            <Chip tone={h.ingest === "LIVE" ? "buy" : h.ingest === "DEGRADED" ? "warn" : "danger"}>{h.ingest.replace("_", " ")}</Chip>
          </div>
          <KV label="Heartbeat Age" value={fmtAge(h.hbAge)} />
          <KV label="Trades Age" value={fmtAge(h.tradesAge)} />
          <KV label="AI Age" value={fmtAge(h.decisionsAge)} />
        </div>
      </Panel>

      <Panel
        title="PnL Truth (MT5 Snapshot)"
        right={<FreshnessBadge ageSec={snapAge} staleAfter={120} />}
        className="col-span-12 lg:col-span-5"
      >
        {snap ? (
          <div className="grid grid-cols-2 gap-x-4">
            <KV label="Balance" value={fmtMoney(balance)} />
            <KV label="Equity" value={fmtMoney(equity)} />
            <KV label="Floating PnL" value={fmtMoney(profit)} tone={Number(profit) > 0 ? "buy" : Number(profit) < 0 ? "sell" : undefined} />
            <KV label="Closed PnL Today" value={fmtMoney(closedPnlToday)} tone={closedPnlToday > 0 ? "buy" : closedPnlToday < 0 ? "sell" : undefined} />
            <KV label="Daily PnL (BE)" value={dailyPnl != null ? fmtMoney(dailyPnl) : "—"} />
            <KV label="Total PnL (BE)" value={totalPnl != null ? fmtMoney(totalPnl) : "—"} />
            <KV label="Open Trades" value={openTrades.length} />
            <KV label="Source" value={(snap?.source ?? "MT5") as any} tone="acc" />
          </div>
        ) : (
          <StatePanel state="NO_DATA" message="NO ACCOUNT SNAPSHOT" hint="account_snapshots table empty" />
        )}
      </Panel>

      <Panel title="Strategy Counts" className="col-span-12 lg:col-span-3">
        <StrategyCounts />
      </Panel>

      {/* Active symbol cards */}
      <Panel title="Active Symbols" className="col-span-12 lg:col-span-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SYMBOLS.map((s) => (
            <SymbolMiniCard key={s} symbol={s} decisions={decisions} />
          ))}
        </div>
      </Panel>

      <Panel title="Latest AI Decision" className="col-span-12 lg:col-span-4">
        <LatestDecisionCard decisions={decisions} />
      </Panel>

      <Panel title="Safety & Routing Config" className="col-span-12 lg:col-span-7">
        <SafetyConfigPanel />
      </Panel>

      <Panel title="Cycle Status" className="col-span-12 lg:col-span-5">
        <CycleStatusPanel />
      </Panel>

      <Panel title="Alerts" className="col-span-12">
        <AlertsRow />
      </Panel>
    </div>
  );
}

function SafetyConfigPanel() {
  const ds: any = useDashboardStatusPayload();
  const acct = ds?.account ?? {};
  const bs = ds?.balanced_selector ?? {};
  const re = ds?.risk_exposure ?? {};

  const demoOnly = acct.demo_only ?? ds?.demo_only;
  const allowLive = acct.allow_live_trading ?? ds?.allow_live_trading;
  const maxLot = acct.demo_max_lot ?? bs?.demo_max_lot ?? ds?.demo_max_lot ?? re?.max_lot;
  const maxTotal = bs?.max_total_open_demo_trades ?? re?.max_total_open ?? ds?.demo_max_open_trades;
  const maxPerSym = bs?.max_open_per_symbol ?? re?.max_per_symbol;
  const fibOn = bs?.fib_confluence_enabled ?? ds?.fib_confluence?.enabled;
  const packOn = bs?.strategy_pack_enabled ?? ds?.strategy_pack?.enabled;
  const noD = bs?.no_d_grade_routing;
  const noMC = bs?.no_market_closed_routing;

  const has = Object.keys(ds ?? {}).length > 0;
  if (!has) return <StatePanel state="NO_DATA" message="DASHBOARD_STATUS NOT EMITTED" />;

  return (
    <div className="grid grid-cols-2 gap-x-4">
      <KV label="demo_only" value={renderBool(demoOnly)} tone={demoOnly === true ? "buy" : "warn"} />
      <KV label="allow_live_trading" value={renderBool(allowLive)} tone={allowLive === false ? "buy" : "sell"} />
      <KV label="demo_max_lot" value={maxLot ?? "—"} />
      <KV label="max_total_open_demo_trades" value={maxTotal ?? "—"} />
      <KV label="max_open_per_symbol" value={maxPerSym ?? "—"} />
      <KV label="fib_confluence_enabled" value={renderBool(fibOn)} tone={fibOn ? "buy" : "dim"} />
      <KV label="hermes_pack_enabled" value={renderBool(packOn)} tone={packOn ? "buy" : "dim"} />
      <KV label="no_d_grade_routing" value={renderBool(noD)} tone={noD ? "buy" : "warn"} />
      <KV label="no_market_closed_routing" value={renderBool(noMC)} tone={noMC ? "buy" : "warn"} />
    </div>
  );
}

function CycleStatusPanel() {
  const ds: any = useDashboardStatusPayload();
  const c = ds?.cycle_status;
  if (!c) return <StatePanel state="NO_DATA" message="cycle_status MISSING" />;
  const startAge = ageSecFrom(c.last_cycle_start_utc);
  const endAge = ageSecFrom(c.last_cycle_end_utc);
  return (
    <div className="grid grid-cols-2 gap-x-4">
      <KV label="Last Status" value={c.last_status ?? "—"} tone={c.last_status === "RUNNING" ? "acc" : "dim"} />
      <KV label="Analyzed" value={c.analyzed ?? "—"} />
      <KV label="Skipped" value={c.skipped ?? "—"} />
      <KV label="Demo Orders" value={c.demo_orders ?? "—"} />
      <KV label="Cycle Start" value={startAge != null ? fmtAge(startAge) + " ago" : "—"} />
      <KV label="Cycle End" value={endAge != null ? fmtAge(endAge) + " ago" : c.last_cycle_end_utc == null ? "IN PROGRESS" : "—"} tone={c.last_cycle_end_utc == null ? "acc" : undefined} />
    </div>
  );
}

function renderBool(v: any) {
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  return "—";
}

function SymbolMiniCard({ symbol, decisions }: { symbol: string; decisions: any[] }) {
  const ds: any = useDashboardStatusPayload();
  const tabs = ds?.order_flow?.tabs ?? ds?.payload?.order_flow?.tabs ?? {};
  const node = tabs[symbol] ?? tabs[SYMBOL_BROKER[symbol]] ?? {};
  const price = node?.price ?? node?.chart_series?.price;
  const status = String(node?.status ?? "").toUpperCase();
  const ageS = node?.age_seconds != null ? Number(node.age_seconds) : ageSecFrom(node?.last_update);
  const stale = status === "STALE" || (ageS != null && ageS > 60);

  const dec = decisions.find((d) => normalizeSym(d.symbol) === symbol);
  const decAge = ageSecFrom(dec?.created_at);
  const decStale = decAge != null && decAge > 300;

  return (
    <div
      className="flex flex-col gap-2 p-2"
      style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, opacity: stale ? 0.65 : 1 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.16em]" style={{ color: T.acc, fontFamily: "Archivo" }}>
          {SYMBOL_BROKER[symbol] ?? symbol}
        </span>
        {stale ? <Chip tone="warn">STALE</Chip> : price != null ? <Chip tone="buy">LIVE</Chip> : <Chip tone="danger">NO DATA</Chip>}
      </div>
      <div
        className="text-[18px] tabular-nums font-bold"
        style={{ color: stale ? T.dim : T.txt, fontFamily: "JetBrains Mono, monospace" }}
      >
        {stale || price == null ? "—" : Number(price).toLocaleString(undefined, { maximumFractionDigits: 5 })}
      </div>
      <div className="flex items-center justify-between text-[10px]" style={{ color: T.dim }}>
        <span>{dec ? String(dec.decision).replace(/_/g, " ") : "NO DECISION"}</span>
        {dec && <span className="tabular-nums">{decStale ? <Chip tone="warn">STALE {fmtAge(decAge)}</Chip> : fmtAge(decAge)}</span>}
      </div>
    </div>
  );
}

function LatestDecisionCard({ decisions }: { decisions: any[] }) {
  const d = decisions[0];
  if (!d) return <StatePanel state="NO_DATA" message="NO AI DECISIONS RECORDED" />;
  const age = ageSecFrom(d.created_at);
  const stale = age != null && age > 300;
  return (
    <div className="flex flex-col gap-1" style={{ opacity: stale ? 0.55 : 1 }}>
      <div className="flex items-center gap-2">
        <Chip tone="acc">{d.symbol}</Chip>
        <Chip tone={String(d.decision).includes("ROUTE") ? "buy" : "warn"}>{String(d.decision).replace(/_/g, " ")}</Chip>
        <Chip tone="dim" outline>ANALYSIS ONLY</Chip>
        {stale && <Chip tone="warn">STALE · {fmtAge(age)}</Chip>}
      </div>
      <KV label="Confidence" value={d.confidence != null ? Number(d.confidence).toFixed(2) : "—"} />
      <KV label="Reason" value={d.reason ?? "—"} />
      <KV label="Age" value={fmtAge(age)} />
    </div>
  );
}

function StrategyCounts() {
  const ds: any = useDashboardStatusPayload();
  const sm = ds?.strategy_manager ?? ds?.strategies ?? {};
  const active = Number(sm?.active_execution_count ?? sm?.active_execution ?? 0);
  const confirm = Number(sm?.confirmation_count ?? sm?.confirmation ?? 0);
  const feed = Number(sm?.internal_feed_count ?? sm?.internal_feed ?? 0);
  const total = active + confirm + feed;
  if (!total) return <StatePanel state="NO_DATA" message="STRATEGY ROSTER NOT EMITTED" />;
  return (
    <div className="flex flex-col gap-1">
      <KV label="Active Execution" value={active} tone="acc" />
      <KV label="Confirmation" value={confirm} />
      <KV label="Internal Feed" value={feed} tone="dim" />
      <KV label="Total" value={total} />
    </div>
  );
}

function AlertsRow() {
  const ds: any = useDashboardStatusPayload();
  const alerts: { tone: "warn" | "danger" | "buy" | "acc"; text: string }[] = [];
  const h = useDualHealth();

  if (h.backend !== "ONLINE") alerts.push({ tone: "warn", text: `BACKEND ${h.backend}` });
  if (h.ingest !== "LIVE") alerts.push({ tone: "warn", text: `INGEST ${h.ingest}` });

  const tabs = ds?.order_flow?.tabs ?? ds?.payload?.order_flow?.tabs ?? {};
  for (const [k, v] of Object.entries(tabs)) {
    const node: any = v;
    if (node?.status === "STALE") alerts.push({ tone: "warn", text: `${node?.broker_symbol ?? k} ORDER FLOW STALE` });
  }
  if (!alerts.length) alerts.push({ tone: "buy", text: "NO ACTIVE ALERTS" });

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a, i) => <Chip key={i} tone={a.tone}>{a.text}</Chip>)}
    </div>
  );
}

function normalizeSym(s: any): string {
  const x = String(s ?? "").toUpperCase().replace(/#$/, "");
  if (x === "XAUUSD") return "GOLD";
  return x;
}
