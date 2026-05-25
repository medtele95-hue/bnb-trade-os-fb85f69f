import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, KV } from "@/components/dashboard/Panel";
import { CandleChart } from "@/components/dashboard/CandleChart";
import { Clock } from "@/components/dashboard/Clock";
import {
  mockMetrics,
  mockMarkov,
  mockKelly,
  mockDecision,
  mockStrategies,
  mockSkipped,
  mockStack,
  mockAgents,
  mockJournal,
  mockLogs,
} from "@/lib/mock-data";

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

function Header() {
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
          <div>BOT STATUS: <b>ONLINE</b><span className="blink ml-1">_</span></div>
          <div>MODE: <b>READ ONLY</b></div>
          <div>RDP: <b>CONNECTED</b></div>
          <div>MT5: <b>CONNECTED</b></div>
          <div className="col-span-2 flex items-center justify-between border-t border-dashed border-black/40 pt-1 mt-0.5">
            <span>TIME</span>
            <Clock />
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
          <StatusDot label="SUPABASE: MOCK" />
          <StatusDot label="WS: LIVE" />
          <span>v0.1.0 — HERMES</span>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <Panel title="TOTAL PNL — VERIFIED FROM MT5" right="ACCT: DEMO" className="col-span-8">
      <div className="grid grid-cols-3 gap-3 items-center">
        <div className="col-span-2 px-2 py-3">
          <div className="text-[10px] uppercase opacity-70 tracking-widest">Total PnL</div>
          <div className="pixel text-[88px] leading-none tracking-tighter text-profit">
            ${mockMetrics.totalPnl.toLocaleString()}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] uppercase tracking-widest">
            <StatusDot label="Verified from MT5" />
            <StatusDot label="Account: Demo / Live" />
            <StatusDot label="Broker Connected" />
          </div>
        </div>
        <div className="border-l border-black p-2 space-y-0.5">
          <KV k="Trades Today" v={mockMetrics.tradesToday} />
          <KV k="Daily PnL" v={`+$${mockMetrics.dailyPnl}`} accent="profit" />
          <KV k="Win Rate" v={`${mockMetrics.winRate}%`} />
          <KV k="Profit Factor" v={mockMetrics.profitFactor} />
          <KV k="Open Positions" v={mockMetrics.openPositions} />
          <KV k="Max DD" v={`${mockMetrics.maxDrawdown}%`} accent="loss" />
        </div>
      </div>
    </Panel>
  );
}

function MetricsRow() {
  const items = [
    { k: "Trades Today", v: mockMetrics.tradesToday },
    { k: "Total Trades", v: mockMetrics.totalTrades.toLocaleString() },
    { k: "Win Rate", v: `${mockMetrics.winRate}%` },
    { k: "Daily PnL", v: `+$${mockMetrics.dailyPnl}`, a: "profit" as const },
    { k: "Avg Ticket", v: `$${mockMetrics.averageTicket}` },
    { k: "Profit Factor", v: mockMetrics.profitFactor },
    { k: "Max DD", v: `${mockMetrics.maxDrawdown}%`, a: "loss" as const },
    { k: "Open Pos", v: mockMetrics.openPositions },
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
  const m = mockMarkov;
  return (
    <Panel title="MARKOV STATE TRANSITION" right={`${m.symbol} ${m.timeframe}`}>
      <div className="grid grid-cols-5 items-center gap-2 my-2">
        <div className="col-span-2 text-center">
          <div className="text-[9px] uppercase opacity-70">Current State</div>
          <div className="pixel text-[34px] leading-none">{m.currentState}</div>
        </div>
        <div className="text-center text-[28px]">→</div>
        <div className="col-span-2 text-center">
          <div className="text-[9px] uppercase opacity-70">Predicted Next</div>
          <div className="pixel text-[34px] leading-none">{m.predictedState}</div>
        </div>
      </div>
      <div className="border-y border-dashed border-black/40 py-1 text-center">
        <span className="text-[10px] uppercase opacity-70">probability</span>{" "}
        <span className="pixel text-[18px]">p = {m.probability.toFixed(2)}</span>{" "}
        <span className="ml-3 px-1.5 border border-black text-[10px]">SIGNAL: {m.signal}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        <div><div className="text-[9px] uppercase opacity-70">Signals</div><div className="pixel text-[16px]">{m.signals}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Entered</div><div className="pixel text-[16px] text-profit">{m.entered}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Skipped</div><div className="pixel text-[16px] text-loss">{m.skipped}</div></div>
      </div>
    </Panel>
  );
}

function Kelly() {
  const k = mockKelly;
  return (
    <Panel title="KELLY RISK ENGINE" right="f* = p−(1−p)/b">
      <div className="border border-dashed border-black/50 p-2 text-center my-1">
        <span className="pixel text-[14px]">{k.formula}</span>
      </div>
      <KV k="Model Probability" v={k.modelProbability.toFixed(2)} />
      <KV k="Reward / Risk" v={k.rewardRisk.toFixed(1)} />
      <KV k="Edge" v={`${k.edge}%`} />
      <KV k="Fractional Kelly" v={k.fractionalKelly.toFixed(2)} />
      <KV k="Final Risk" v={`${k.finalRisk}%`} />
      <KV k="Lot Size" v={k.lotSize.toFixed(2)} />
      <div className="mt-2 border border-black px-2 py-1 text-center bg-foreground text-background text-[11px] tracking-widest">
        RISK STATUS: {k.status}
      </div>
    </Panel>
  );
}

function Decision() {
  const d = mockDecision;
  return (
    <Panel title="AI DECISION OBJECT" right="LATEST BACKEND DECISION">
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="Symbol" v={d.symbol} />
        <KV k="Timeframe" v={d.timeframe} />
        <KV k="Market State" v={d.marketState} />
        <KV k="Markov p" v={d.markovProbability.toFixed(2)} />
        <KV k="Strategy" v={d.strategy} />
        <KV k="Signal" v={d.signal} accent="profit" />
        <KV k="Confidence" v={`${d.confidence}%`} />
        <KV k="Risk Status" v={d.riskStatus} />
        <KV k="Lot" v={d.lotSize} />
        <KV k="Entry" v={d.entry} />
        <KV k="SL" v={d.sl} accent="loss" />
        <KV k="TP" v={d.tp} accent="profit" />
      </div>
      <div className="mt-2 border-t border-black pt-1.5">
        <div className="text-[9px] uppercase opacity-70">Decision</div>
        <div className="pixel text-[20px]">{d.decision}</div>
        <div className="text-[10px] mt-1 opacity-80">
          <b>REASON:</b> {d.reason}
        </div>
        <div className="text-[10px] opacity-80">
          <b>BLOCKED:</b> {d.blockedReason}
        </div>
      </div>
    </Panel>
  );
}

function Strategies() {
  return (
    <Panel title="STRATEGY MODULES" right={`${mockStrategies.length} loaded`}>
      <div className="grid grid-cols-4 gap-2">
        {mockStrategies.map((s) => (
          <div key={s.name} className="border border-black p-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[11px]">{s.name}</div>
              <div className="text-[9px] border border-black px-1">{s.status}</div>
            </div>
            <div className="mt-1.5 space-y-0.5">
              <KV k="Signal" v={s.signal} />
              <KV k="Confidence" v={`${s.confidence}%`} />
              <KV k="Win Rate" v={`${s.winRate}%`} />
              <KV k="Today PnL" v={`${s.pnl >= 0 ? "+" : ""}$${s.pnl.toFixed(2)}`} accent={s.pnl >= 0 ? "profit" : "loss"} />
            </div>
            <div className="mt-1 text-[10px] opacity-80 italic line-clamp-2">"{s.reason}"</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SkipEngine() {
  return (
    <Panel title="SIGNAL SKIP ENGINE" right={`SKIPPED: ${mockSkipped.length}`}>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-black text-left uppercase tracking-wider">
            <th className="py-1">Time</th>
            <th>Symbol</th>
            <th>Strategy</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {mockSkipped.map((s, i) => (
            <tr key={i} className="border-b border-dashed border-black/40">
              <td className="py-1 pixel">{s.time}</td>
              <td>{s.symbol}</td>
              <td>{s.strategy}</td>
              <td className="text-loss">{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Stack() {
  return (
    <Panel title="TRADING STACK" right="5 NODES">
      <div className="grid grid-cols-5 gap-2">
        {mockStack.map((n) => (
          <div key={n.name} className="border border-black p-2">
            <div className="font-bold text-[11px]">{n.name}</div>
            <div className="text-[9px] opacity-70 leading-tight mt-0.5">{n.desc}</div>
            <div className="mt-1.5 space-y-0.5">
              <KV k="Uptime" v={n.uptime} />
              <KV k="Health" v={n.health} accent="profit" />
              <KV k="Latency" v={n.latency} />
              <KV k="Status" v={n.status} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SelfLearn() {
  const steps = [
    { n: "01", t: "TRADE EXECUTES", d: "Entry, exit, PnL, strategy and reason are logged." },
    { n: "02", t: "NIGHTLY REVIEW", d: "Bot reviews all trades of the day." },
    { n: "03", t: "STRATEGY SUGGESTIONS", d: "Best setup, worst setup, best session, worst session." },
    { n: "04", t: "RISK UPDATE", d: "Bot recommends risk changes — never auto-applied to live rules." },
  ];
  return (
    <Panel title="SELF-LEARNING NIGHTLY LOOP" right="03:00 UTC">
      <div className="grid grid-cols-4 gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className={`p-2 ${i < steps.length - 1 ? "border-r border-dashed border-black/50" : ""}`}>
            <div className="pixel text-[28px] leading-none">{s.n}</div>
            <div className="font-bold text-[11px] mt-1">{s.t}</div>
            <div className="text-[10px] opacity-80 mt-1 leading-snug">{s.d}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Telegram() {
  return (
    <Panel title="TELEGRAM REPORT" right="@HERMES_BOT">
      <div className="border border-black p-2 bg-secondary">
        <div className="flex items-center justify-between border-b border-dashed border-black/50 pb-1 mb-1">
          <b>HERMES TRADING BOT</b>
          <span className="text-[10px] border border-black px-1">ONLINE</span>
        </div>
        <div className="text-[10px] uppercase opacity-70 mt-1">Nightly Report</div>
        <KV k="Trades" v="47" />
        <KV k="Win Rate" v="65.1%" />
        <KV k="P/L" v="+$312.44" accent="profit" />
        <KV k="Best Symbol" v="BTCUSD" />
        <KV k="Worst Setup" v="Counter-trend entry" accent="loss" />
        <div className="text-[10px] mt-1 opacity-80 italic">
          ▶ Suggestion: Avoid low-volatility breakouts
        </div>
      </div>
      <div className="mt-2 border border-black p-2">
        <div className="text-[10px] uppercase opacity-70">Latest Alert</div>
        <div className="pixel text-[14px]">FILLED · BTCUSD · BUY</div>
        <div className="grid grid-cols-2 gap-x-3 mt-1">
          <KV k="Entry" v="77860" />
          <KV k="Risk" v="0.5%" />
          <KV k="SL" v="77450" accent="loss" />
          <KV k="TP" v="78600" accent="profit" />
        </div>
      </div>
    </Panel>
  );
}

function VideoAgents() {
  return (
    <Panel title="VIDEO AGENTS" right={`${mockAgents.length} ONLINE`}>
      <div className="grid grid-cols-3 gap-2">
        {mockAgents.map((a) => (
          <div key={a.name} className="border border-black p-2">
            <div className="flex items-center justify-between border-b border-dashed border-black/50 pb-1">
              <b className="text-[11px]">{a.name}</b>
              <span className="text-[9px] border border-black px-1">{a.tag}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {a.rows.map(([k, v]) => (
                <KV key={k} k={k} v={v} />
              ))}
            </div>
            <div className="mt-1.5 border border-black bg-foreground text-background text-[10px] tracking-widest text-center py-0.5">
              {a.status}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Journal() {
  return (
    <Panel title="TRADE JOURNAL" right={`${mockJournal.length} ROWS`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-black text-left uppercase tracking-wider">
              {["Time","Magic","Sym","Dir","Entry","SL","TP","Lot","PnL","Result","Strategy","Conf","Reason"].map(h => (
                <th key={h} className="py-1 pr-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockJournal.map((t, i) => (
              <tr key={i} className="border-b border-dashed border-black/40">
                <td className="py-1 pr-2 pixel">{t.time}</td>
                <td className="pr-2">{t.magic}</td>
                <td className="pr-2">{t.symbol}</td>
                <td className="pr-2">{t.dir}</td>
                <td className="pr-2 pixel">{t.entry}</td>
                <td className="pr-2 pixel text-loss">{t.sl}</td>
                <td className="pr-2 pixel text-profit">{t.tp}</td>
                <td className="pr-2">{t.lot}</td>
                <td className={`pr-2 pixel ${t.pnl >= 0 ? "text-profit" : "text-loss"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl}</td>
                <td className="pr-2">{t.result}</td>
                <td className="pr-2">{t.strategy}</td>
                <td className="pr-2">{t.confidence}%</td>
                <td className="pr-2 italic opacity-80">{t.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function LogsTerminal() {
  return (
    <Panel title="LOGS TERMINAL" right="STDOUT">
      <div className="bg-foreground text-background p-2 text-[10px] leading-snug font-mono">
        {mockLogs.map((l, i) => (
          <div key={i}>
            <span className="opacity-60">$</span> {l}
          </div>
        ))}
        <div>
          <span className="opacity-60">$</span> <span className="blink">█</span>
        </div>
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

function Dashboard() {
  return (
    <div className="min-h-screen p-3 max-w-[1600px] mx-auto">
      <Header />

      <div className="grid grid-cols-12 gap-3 mt-3">
        <Hero />
        <Panel title="BTCUSD / USD · 5-MIN" right="LIVE" className="col-span-4">
          <div className="flex items-baseline justify-between">
            <div className="pixel text-[36px] leading-none">$77,860</div>
            <div className="text-profit pixel text-[14px]">+0.45%</div>
          </div>
          <div className="text-[10px] uppercase opacity-70 mt-1">Mini snapshot</div>
          <div className="mt-2">
            <CandleChart />
          </div>
        </Panel>
      </div>

      <MetricsRow />

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-3"><Markov /></div>
        <div className="col-span-3"><Kelly /></div>
        <Panel title="BTCUSD / USD · 5-MIN — MAIN CHART" right="ENTER · FILLED · +$47 · EXIT" className="col-span-6">
          <div className="flex items-baseline justify-between mb-1">
            <div className="pixel text-[28px] leading-none">$77,860</div>
            <div className="text-profit pixel text-[14px]">+0.45%</div>
          </div>
          <CandleChart />
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-5"><Decision /></div>
        <div className="col-span-7"><Strategies /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-5"><SkipEngine /></div>
        <div className="col-span-7"><Stack /></div>
      </div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-8"><SelfLearn /></div>
        <div className="col-span-4 row-span-2"><Telegram /></div>
        <div className="col-span-8"><Robots /></div>
      </div>

      <div className="mt-3"><Journal /></div>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-7"><LogsTerminal /></div>
        <div className="col-span-5"><ControlPanel /></div>
      </div>

      <footer className="mt-4 border-t border-black pt-2 text-[10px] uppercase tracking-widest flex justify-between opacity-80">
        <div>HERMES TRADING TERMINAL · BUILD 0.1.0 · MOCK DATA MODE</div>
        <div>© {new Date().getFullYear()} — DO NOT TRADE FROM THIS DASHBOARD</div>
      </footer>
    </div>
  );
}
