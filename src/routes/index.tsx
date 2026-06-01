import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, KV } from "@/components/dashboard/Panel";
import { CandleChart } from "@/components/dashboard/CandleChart";
import { Clock } from "@/components/dashboard/Clock";
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
  useBackendTime,
} from "@/components/dashboard/DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";

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
  const { rows: statuses } = useLiveTable<any>("bot_status", { orderBy: "component", ascending: true, limit: 20 });
  const byKey: Record<string, any> = {};
  statuses.forEach((s) => (byKey[s.component] = s));
  const rdp = byKey["RDP"]?.status ?? "—";
  const mt5 = byKey["MT5"]?.status ?? "—";
  const bot = byKey["HERMES"]?.status ?? (statuses.length ? "ONLINE" : "WAITING");

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
          <div>MODE: <b>READ ONLY · DEMO PILOT</b></div>
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
          <StatusDot label="SUPABASE: LIVE" />
          <StatusDot label="REALTIME: ON" />
          <span>v0.2.0 — HERMES</span>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  const { rows, empty } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const s = rows[0];
  return (
    <Panel title="TOTAL PNL — VERIFIED FROM MT5" right="ACCT: LIVE" className="col-span-8">
      {empty || !s ? (
        <Waiting />
      ) : (
        <div className="grid grid-cols-3 gap-3 items-center">
          <div className="col-span-2 px-2 py-3">
            <div className="text-[10px] uppercase opacity-70 tracking-widest">Total PnL</div>
            <div className="pixel text-[88px] leading-none tracking-tighter text-profit">
              ${Number(s.total_pnl ?? 0).toLocaleString()}
            </div>
            <div className="flex gap-4 mt-3 text-[10px] uppercase tracking-widest flex-wrap">
              <StatusDot label="Verified from MT5" />
              <StatusDot label="Account: Live" />
              <StatusDot label="Broker Connected" />
              <Badge value="LIVE ACCOUNT READ-ONLY — PAPER EXECUTION ONLY" tone="orange" />
            </div>
          </div>
          <div className="border-l border-black p-2 space-y-0.5">
            <KV k="Trades Today" v={s.trades_today ?? "—"} />
            <KV k="Daily PnL" v={`${(s.daily_pnl ?? 0) >= 0 ? "+" : ""}$${s.daily_pnl ?? 0}`} accent={(s.daily_pnl ?? 0) >= 0 ? "profit" : "loss"} />
            <KV k="Win Rate" v={`${s.win_rate ?? 0}%`} />
            <KV k="Profit Factor" v={s.profit_factor ?? "—"} />
            <KV k="Open Positions" v={s.open_positions ?? 0} />
            <KV k="Max DD" v={`${s.max_drawdown ?? 0}%`} accent="loss" />
          </div>
        </div>
      )}
    </Panel>
  );
}

function MetricsRow() {
  const { rows, empty } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const s = rows[0];
  if (empty || !s) {
    return <div className="border border-black -mt-px p-2"><Waiting label="WAITING FOR HERMES LIVE METRICS" /></div>;
  }
  const items = [
    { k: "Trades Today", v: s.trades_today ?? 0 },
    { k: "Total Trades", v: (s.total_trades ?? 0).toLocaleString() },
    { k: "Win Rate", v: `${s.win_rate ?? 0}%` },
    { k: "Daily PnL", v: `${(s.daily_pnl ?? 0) >= 0 ? "+" : ""}$${s.daily_pnl ?? 0}`, a: ((s.daily_pnl ?? 0) >= 0 ? "profit" : "loss") as "profit" | "loss" },
    { k: "Equity", v: `$${(s.equity ?? 0).toLocaleString()}` },
    { k: "Profit Factor", v: s.profit_factor ?? "—" },
    { k: "Max DD", v: `${s.max_drawdown ?? 0}%`, a: "loss" as const },
    { k: "Open Pos", v: s.open_positions ?? 0 },
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
            <KV k="Lot" v={d.lot_size ?? "—"} />
            <KV k="Entry" v={d.entry ?? "—"} />
            <KV k="SL" v={d.sl ?? "—"} accent="loss" />
            <KV k="TP" v={d.tp ?? "—"} accent="profit" />
          </div>
          <div className="mt-2 border-t border-black pt-1.5">
            <div className="text-[9px] uppercase opacity-70">Decision</div>
            <div className="pixel text-[20px]">{d.decision ?? "—"}</div>
            <div className="text-[10px] mt-1 opacity-80"><b>REASON:</b> {d.reason ?? "—"}</div>
            <div className="text-[10px] opacity-80"><b>BLOCKED:</b> {d.blocked_reason ?? "None"}</div>
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
  const u = (v: any) => (v == null || v === "" ? "UNKNOWN" : v);
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
                const u = (v: any) => (v == null || v === "" ? "UNKNOWN" : v);
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
                        : "UNKNOWN"
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

function LogsTerminal() {
  const { rows, empty } = useLiveTable<any>("bot_logs", { limit: 25 });
  const ordered = [...rows].reverse();
  return (
    <Panel title="LOGS TERMINAL" right="STDOUT">
      <div className="bg-foreground text-background p-2 text-[10px] leading-snug font-mono">
        {empty ? (
          <div className="opacity-70">$ WAITING FOR HERMES LIVE LOGS <span className="blink">█</span></div>
        ) : (
          <>
            {ordered.map((l) => (
              <div key={l.id}>
                <span className="opacity-60">$</span> [{new Date(l.created_at).toISOString().slice(11, 19)}] {l.source ? `${l.source}: ` : ""}{l.message}
              </div>
            ))}
            <div><span className="opacity-60">$</span> <span className="blink">█</span></div>
          </>
        )}
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
      <div className="pixel text-[36px] leading-none">{m?.price ? `$${Number(m.price).toLocaleString()}` : "—"}</div>
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
        <Panel title="BTCUSD / USD · 5-MIN — MAIN CHART" right="ENTER · FILLED · EXIT" className="col-span-6">
          <ChartPrice />
          <CandleChart />
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-7"><Decision /></div>
        <div className="col-span-5"><SafetyGuard /></div>
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

      <footer className="mt-4 border-t-2 border-black pt-2 text-[10px] uppercase tracking-widest">
        <div className="bg-foreground text-background px-3 py-2 text-center font-bold tracking-widest">
          DASHBOARD IS READ-ONLY. EXECUTION CAN ONLY HAPPEN FROM BACKEND DEMO ROUTER AFTER ALL SAFETY GATES PASS. LIVE TRADING IS BLOCKED.
        </div>
        <div className="flex justify-between mt-2 opacity-80">
          <div>HERMES TRADING TERMINAL · BUILD 0.3.0 · DEMO PILOT 24H</div>
          <div>© {new Date().getFullYear()} — DO NOT TRADE FROM THIS DASHBOARD</div>
        </div>
      </footer>
    </div>
  );
}
