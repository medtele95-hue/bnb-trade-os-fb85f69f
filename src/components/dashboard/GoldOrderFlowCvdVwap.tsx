import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDashboardStatusPayload } from "./DemoCenter";
import { isSameSymbol } from "@/lib/symbol";

const STRATEGY = "GOLD_ORDER_FLOW_CVD_VWAP";

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
function bool(v: any): "TRUE" | "FALSE" | "—" {
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  return "—";
}

const LOG_FILTERS = [
  "GOLD_ORDER_FLOW_CVD_VWAP",
  "MICRO_DISCOVERY",
  "DEMO_GATE",
  "ROUTER_HANDOFF",
  "QUICK_EXIT",
  "ORDER_CONFIRMED",
  "ORDER_BLOCKED",
];

function pickStrategyPayload(raw: any): any {
  if (!raw || typeof raw !== "object") return {};
  const inner = raw.raw_payload ?? {};
  return (
    raw.gold_order_flow_cvd_vwap ??
    inner.gold_order_flow_cvd_vwap ??
    raw.GOLD_ORDER_FLOW_CVD_VWAP ??
    inner.GOLD_ORDER_FLOW_CVD_VWAP ??
    raw[STRATEGY] ??
    inner[STRATEGY] ??
    {}
  );
}

export function GoldOrderFlowCvdVwapPanel() {
  const ds = useDashboardStatusPayload();
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 50 });
  const { rows: signals } = useLiveTable<any>("strategy_signals", { limit: 50 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 300 });
  const { rows: logs } = useLiveTable<any>("bot_logs", { limit: 200 });

  // Find latest ai_decision carrying this strategy payload (or matching XAU)
  const latestDecision = decisions.find((d: any) => {
    const p = pickStrategyPayload(d?.raw_payload);
    if (p && Object.keys(p).length > 0) return true;
    const sym = d?.symbol ?? d?.raw_payload?.symbol;
    const strat = (d?.strategy ?? d?.raw_payload?.strategy ?? "").toString().toUpperCase();
    return strat === STRATEGY && (sym ? isSameSymbol(sym, "XAUUSD") : false);
  });
  const latestSignal = signals.find((s: any) =>
    (s?.strategy ?? "").toString().toUpperCase() === STRATEGY
  );

  const rp = (latestDecision?.raw_payload ?? {}) as any;
  const g = pickStrategyPayload(rp);
  const sig = latestSignal ?? {};

  const status = String(g.status ?? sig.status ?? "NO SIGNAL").toUpperCase();
  const decision = String(g.signal ?? g.decision ?? sig.signal ?? "NO_SIGNAL").toUpperCase();
  const confidence = g.confidence ?? sig.confidence ?? null;
  const symbol = g.symbol ?? sig.symbol ?? "XAUUSD#";
  const tf = g.timeframe ?? sig.timeframe ?? "M5";
  const lastUpdate = g.last_update ?? g.updated_at ?? latestDecision?.created_at ?? sig.created_at ?? null;

  const statusTone: "green" | "orange" | "red" | "yellow" | "gray" =
    status === "ACTIVE" ? "green" :
    status === "OBSERVE" ? "yellow" :
    status === "BLOCKED" ? "red" :
    "gray";

  const decisionTone: "green" | "red" | "gray" =
    decision === "BUY" ? "green" : decision === "SELL" ? "red" : "gray";

  // Performance from trades table (GOLD + this strategy + magic 909002)
  const today = new Date().toISOString().slice(0, 10);
  const stratTrades = trades.filter((t: any) => {
    const sym = t.symbol ?? t.raw_payload?.symbol;
    const strat = (t.strategy ?? t.raw_payload?.strategy ?? "").toString().toUpperCase();
    return Number(t.magic_number ?? t.magic) === 909002 &&
      strat === STRATEGY &&
      (sym ? isSameSymbol(sym, "XAUUSD") : true);
  });
  const closedStrat = stratTrades.filter((t: any) =>
    String(t.result ?? "").toUpperCase() === "CLOSED" || t.closed_at != null
  );
  const todaysClosed = closedStrat.filter((t: any) =>
    typeof t.closed_at === "string" && t.closed_at.slice(0, 10) === today
  );
  const openedToday = stratTrades.filter((t: any) => {
    const d = t.opened_at ?? t.created_at;
    return typeof d === "string" && d.slice(0, 10) === today;
  }).length;
  const pnlToday = todaysClosed.reduce((a: number, t: any) => a + Number(t.pnl ?? 0), 0);
  const wins = closedStrat.filter((t: any) => Number(t.pnl ?? 0) > 0);
  const losses = closedStrat.filter((t: any) => Number(t.pnl ?? 0) < 0);
  const winRate = wins.length + losses.length > 0
    ? Math.round((wins.length / (wins.length + losses.length)) * 100)
    : null;
  const grossWin = wins.reduce((a: number, t: any) => a + Number(t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((a: number, t: any) => a + Number(t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);
  const avgWin = wins.length > 0 ? grossWin / wins.length : null;
  const avgLoss = losses.length > 0 ? -(grossLoss / losses.length) : null;
  const last10 = closedStrat.slice(0, 10);

  // Logs filter UI
  const [logFilter, setLogFilter] = React.useState<string | null>(null);
  const filteredLogs = React.useMemo(() => {
    if (!logFilter) return logs.slice(0, 25);
    const f = logFilter.toUpperCase();
    return logs
      .filter((l: any) => {
        const hay = `${l.component ?? ""} ${l.event ?? ""} ${l.message ?? ""} ${JSON.stringify(l.payload ?? l.raw_payload ?? {})}`.toUpperCase();
        return hay.includes(f);
      })
      .slice(0, 25);
  }, [logs, logFilter]);

  // Safety status from dashboard_status payload
  const demoOnly = ds.demo_only ?? ds.DEMO_ONLY ?? (String(ds.account_type ?? "").toUpperCase() === "DEMO");
  const allowLive = ds.allow_live_trading ?? ds.ALLOW_LIVE_TRADING ?? false;
  const microObserveOnly = ds.micro_discovery_observe_only ?? ds.MICRO_DISCOVERY_OBSERVE_ONLY ?? true;
  const quickExitEnabled = ds.quick_exit_enabled ?? ds.QUICK_EXIT_ENABLED ?? true;
  const microDiscoveryMode = ds.micro_discovery_mode ?? ds.MICRO_DISCOVERY_MODE ?? null;

  return (
    <Panel
      title={`${STRATEGY} — Order Flow CVD VWAP`}
      right={<Badge value="READ-ONLY" tone="gray" />}
    >
      <div className="space-y-2">
        {/* Status banner */}
        <div className="border border-black/40 p-2 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider opacity-70">Status</span>
            <Badge value={status} tone={statusTone} />
            <Badge value={`Signal: ${decision}`} tone={decisionTone} />
            <span className="text-[10px] opacity-70">CONF: <b>{pct(confidence)}</b></span>
          </div>
          <Badge value="MT5 Order Flow is approximated using tick volume / CVD proxy" tone="orange" />
        </div>

        {microDiscoveryMode === true && (
          <div className="border border-loss p-2 text-[10px] uppercase tracking-wider text-loss">
            ⚠ MICRO_DISCOVERY must be OBSERVE ONLY. It must not execute orders.
          </div>
        )}

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-x-3">
          <div>
            <KV k="Symbol" v={String(symbol)} />
            <KV k="Timeframe" v={String(tf)} />
            <KV k="Last Signal" v={<Badge value={decision} tone={decisionTone} />} />
            <KV k="Confidence" v={pct(confidence)} />
            <KV k="Entry" v={fmt(g.entry ?? sig.entry, 2)} />
            <KV k="SL" v={fmt(g.sl ?? sig.sl, 2)} accent="loss" />
            <KV k="TP" v={fmt(g.tp ?? sig.tp, 2)} accent="profit" />
            <KV k="POC" v={fmt(g.poc, 2)} />
            <KV k="VAH" v={fmt(g.vah, 2)} />
            <KV k="VAL" v={fmt(g.val, 2)} />
          </div>
          <div>
            <KV k="VWAP" v={fmt(g.vwap, 2)} />
            <KV k="CVD Slope" v={fmt(g.cvd_slope, 4)} />
            <KV k="Latest Delta" v={fmt(g.latest_delta ?? g.delta, 2)} />
            <KV k="Divergence" v={
              <Badge
                value={String(g.divergence ?? "none").toUpperCase()}
                tone={
                  String(g.divergence ?? "").toLowerCase() === "bullish" ? "green" :
                  String(g.divergence ?? "").toLowerCase() === "bearish" ? "red" : "gray"
                }
              />
            } />
            <KV k="Block Reason" v={String(g.block_reason ?? "—")} />
            <KV k="Last Update" v={lastUpdate ? String(lastUpdate).replace("T", " ").slice(0, 19) : "—"} />
          </div>
        </div>

        {/* Performance */}
        <div className="border border-black/40 p-2">
          <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Strategy Performance</div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
            <KV k="Trades Today" v={openedToday} />
            <KV k="PnL Today" v={`${pnlToday >= 0 ? "+" : ""}$${pnlToday.toFixed(2)}`} accent={pnlToday >= 0 ? "profit" : "loss"} />
            <KV k="Win Rate" v={winRate == null ? "—" : `${winRate}%`} />
            <KV k="Profit Factor" v={profitFactor == null ? "—" : (profitFactor === Infinity ? "∞" : profitFactor.toFixed(2))} />
            <KV k="Avg Win" v={avgWin == null ? "—" : `+$${avgWin.toFixed(2)}`} />
            <KV k="Avg Loss" v={avgLoss == null ? "—" : `$${avgLoss.toFixed(2)}`} />
          </div>
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Last 10 Trades</div>
            {last10.length === 0 ? (
              <div className="text-[10px] opacity-60">No closed trades yet</div>
            ) : (
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-black/30 text-left">
                    <th className="py-0.5 pr-2">Closed</th>
                    <th className="pr-2">Side</th>
                    <th className="pr-2">Entry</th>
                    <th className="pr-2">Exit</th>
                    <th className="pr-2">PnL</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {last10.map((t: any, i: number) => {
                    const p = Number(t.pnl ?? 0);
                    return (
                      <tr key={t.id ?? i} className="border-b border-black/10">
                        <td className="py-0.5 pr-2">{t.closed_at ? String(t.closed_at).replace("T", " ").slice(5, 16) : "—"}</td>
                        <td className="pr-2">{String(t.side ?? t.direction ?? "—").toUpperCase()}</td>
                        <td className="pr-2">{fmt(t.entry_price ?? t.open_price, 2)}</td>
                        <td className="pr-2">{fmt(t.exit_price ?? t.close_price, 2)}</td>
                        <td className={`pr-2 ${p >= 0 ? "text-profit" : "text-loss"}`}>{p >= 0 ? "+" : ""}${p.toFixed(2)}</td>
                        <td>{String(t.outcome ?? (p >= 0 ? "WIN" : "LOSS")).toUpperCase()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Safety panel */}
        <div className="border border-black/40 p-2">
          <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Safety Status</div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
            <div>DEMO_ONLY: <b className={demoOnly ? "text-profit" : "text-loss"}>{bool(demoOnly)}</b></div>
            <div>ALLOW_LIVE_TRADING: <b className={allowLive ? "text-loss" : "text-profit"}>{bool(allowLive)}</b></div>
            <div>MICRO_DISCOVERY_OBSERVE_ONLY: <b className={microObserveOnly ? "text-profit" : "text-loss"}>{bool(microObserveOnly)}</b></div>
            <div>QUICK_EXIT_ENABLED: <b>{bool(quickExitEnabled)}</b></div>
            <div>HERMES_MAGIC: <b>909002</b></div>
            <div>MAX_LOT: <b>0.01</b></div>
          </div>
        </div>

        {/* Logs feed moved to the Logs tab — keep this card focused on strategy data */}
        <div className="border border-black/40 p-2 text-[10px] opacity-70 uppercase tracking-wider">
          Live log feed for this strategy is available in the Logs tab.
        </div>

        <div className="text-[9px] opacity-60 uppercase tracking-wider">
          Read-only. Frontend never executes trades. PnL source: MT5_HISTORY_DEALS via dashboard_status.
        </div>
      </div>
    </Panel>
  );
}
