import * as React from "react";
import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";

const DEMO_MAGIC = 909002;
const DEMO_COMMENT = "HERMES_DEMO_KELLY_24H";
const DEMO_MAX_LOT = 0.01;
const DEMO_MAX_RISK_PCT = 0.25;
const DEMO_HOURS = 24;

const UNK = "UNKNOWN";
const u = (v: any) => (v == null || v === "" ? UNK : v);

function getRP(d: any): Record<string, any> {
  if (!d) return {};
  const rp = d.raw_payload ?? {};
  return { ...(rp ?? {}), ...(rp.raw_payload ?? {}) };
}

function getField(sources: any[], key: string): any {
  for (const src of sources) {
    if (!src) continue;
    if (src[key] != null && src[key] !== "") return src[key];
  }
  return undefined;
}

type GateResult = "PASS" | "FAIL" | "UNKNOWN";
function gateTone(s: GateResult) {
  return s === "PASS" ? "green" : s === "FAIL" ? "red" : "gray";
}
function boolGate(v: any): GateResult {
  if (v == null) return "UNKNOWN";
  if (v === true || String(v).toUpperCase() === "PASS" || String(v).toUpperCase() === "OK" || String(v).toUpperCase() === "TRUE") return "PASS";
  if (v === false || String(v).toUpperCase() === "FAIL" || String(v).toUpperCase() === "BLOCK" || String(v).toUpperCase() === "BLOCKED" || String(v).toUpperCase() === "FALSE") return "FAIL";
  return "UNKNOWN";
}

// ============ HEADER MODE BANNER ============
export function DemoModeBanner() {
  const { rows: status } = useLiveTable<any>("bot_status", { limit: 5 });
  const bs = status[0] ?? {};
  const bsRP = getRP(bs);
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const snap = snaps[0] ?? {};
  const snapRP = getRP(snap);

  const sources = [bsRP, bs, snapRP, snap];
  const demoPilotEnabled = getField(sources, "demo_pilot_enabled");
  const demoTrading = getField(sources, "demo_trading");
  const demoOnly = getField(sources, "demo_only");
  const paperTrading = getField(sources, "paper_trading");
  const allowLive = getField(sources, "allow_live_trading");
  const accountType = String(getField(sources, "account_type") ?? "").toUpperCase();
  const magic = getField(sources, "demo_magic_number") ?? getField(sources, "magic_number") ?? DEMO_MAGIC;
  const comment = getField(sources, "demo_comment") ?? DEMO_COMMENT;

  const mode = demoPilotEnabled ? "DEMO PILOT 24H" : demoTrading ? "DEMO" : paperTrading ? "PAPER" : allowLive ? "LIVE" : UNK;
  const accountBadge =
    accountType === "DEMO" ? "DEMO VERIFIED" :
    accountType === "LIVE" ? "LIVE BLOCKED" :
    UNK;

  const liveAlert = accountType === "LIVE" && demoPilotEnabled;
  const liveTradingAlert = allowLive === true;

  return (
    <div className="border-2 border-black mt-3">
      <div className="bg-foreground text-background px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest font-bold">
        <span>MODE: <span className="pixel text-[14px]">{mode}</span></span>
        <span>LIVE TRADING: <span className={liveTradingAlert ? "text-red-400" : ""}>{allowLive == null ? UNK : allowLive ? "ALLOWED ⚠" : "BLOCKED"}</span></span>
        <span>DEMO ONLY: {demoOnly == null ? UNK : demoOnly ? "TRUE" : "FALSE"}</span>
        <span>ACCOUNT: {accountBadge}</span>
        <span>MAGIC: {magic ?? UNK}</span>
        <span>COMMENT: {comment ?? UNK}</span>
      </div>
      {liveAlert && (
        <div className="bg-red-600 text-white px-3 py-2 text-center text-[12px] font-black uppercase tracking-widest">
          ⚠ LIVE ACCOUNT DETECTED — DEMO ROUTER BLOCKED. NO DEMO ORDER CAN BE SENT.
        </div>
      )}
      {liveTradingAlert && (
        <div className="bg-red-600 text-white px-3 py-2 text-center text-[12px] font-black uppercase tracking-widest">
          ⚠ ALLOW_LIVE_TRADING = TRUE. THIS VIOLATES DEMO-ONLY POLICY.
        </div>
      )}
    </div>
  );
}

// ============ DEMO PILOT STATUS ============
export function DemoPilotStatus() {
  const { rows: status } = useLiveTable<any>("bot_status", { limit: 5 });
  const bs = status[0] ?? {};
  const bsRP = getRP(bs);
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const snapRP = getRP(snaps[0]);
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 5 });
  const decRP = getRP(dec[0]);

  const sources = [bsRP, bs, snapRP, decRP];
  const demoPilotEnabled = getField(sources, "demo_pilot_enabled");
  const demoTrading = getField(sources, "demo_trading");
  const demoOnly = getField(sources, "demo_only");
  const paperTrading = getField(sources, "paper_trading");
  const allowLive = getField(sources, "allow_live_trading");
  const pilotStartedAt = getField(sources, "pilot_started_at") ?? getField(sources, "demo_pilot_started_at");
  const pilotExpiresAt = getField(sources, "pilot_expires_at") ?? getField(sources, "demo_pilot_expires_at");
  let hoursRemaining = getField(sources, "pilot_hours_remaining") ?? getField(sources, "demo_pilot_hours_remaining");
  if (hoursRemaining == null && pilotExpiresAt) {
    const ms = new Date(pilotExpiresAt).getTime() - Date.now();
    if (!isNaN(ms)) hoursRemaining = Math.max(0, ms / 3600000).toFixed(2);
  }
  const accountType = getField(sources, "account_type");
  const mt5 = getField(sources, "mt5_connected");
  const lastGateDec = getField([decRP, dec[0]], "last_demo_gate_decision") ?? getField([decRP, dec[0]], "demo_gate_decision");
  const lastGateReason = getField([decRP, dec[0]], "last_demo_gate_reason") ?? getField([decRP, dec[0]], "demo_gate_reason");
  const lastDemoTicket = getField([decRP, dec[0], bsRP, bs], "last_demo_ticket");

  return (
    <Panel title="DEMO PILOT STATUS" right="24H KELLY ROUTER">
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="demo_pilot_enabled" v={String(u(demoPilotEnabled))} />
        <KV k="demo_trading" v={String(u(demoTrading))} />
        <KV k="demo_only" v={String(u(demoOnly))} />
        <KV k="paper_trading" v={String(u(paperTrading))} />
        <KV k="allow_live_trading" v={String(u(allowLive))} accent={allowLive ? "loss" : undefined} />
        <KV k="account_type" v={String(u(accountType))} />
        <KV k="mt5_connected" v={String(u(mt5))} />
        <KV k="pilot_started_at" v={pilotStartedAt ? new Date(pilotStartedAt).toISOString().slice(0, 19).replace("T", " ") : UNK} />
        <KV k="pilot_expires_at" v={pilotExpiresAt ? new Date(pilotExpiresAt).toISOString().slice(0, 19).replace("T", " ") : UNK} />
        <KV k="pilot_hours_remaining" v={hoursRemaining != null ? `${hoursRemaining} / ${DEMO_HOURS}h` : UNK} />
        <KV k="last_demo_gate_decision" v={String(u(lastGateDec))} />
        <KV k="last_demo_ticket" v={String(u(lastDemoTicket))} />
      </div>
      <div className="mt-1 text-[10px] opacity-80"><b>LAST GATE REASON:</b> {String(u(lastGateReason))}</div>
    </Panel>
  );
}

// ============ DEMO GATE CHECKLIST ============
const GATE_KEYS: Array<{ label: string; keys: string[]; truthy?: any[] }> = [
  { label: "MT5 connected", keys: ["mt5_connected", "gate_mt5_connected"] },
  { label: "Account type DEMO", keys: ["gate_account_type_demo", "account_type_demo"] },
  { label: "Live trading blocked", keys: ["gate_live_blocked", "live_trading_blocked"] },
  { label: "Demo pilot enabled", keys: ["demo_pilot_enabled", "gate_demo_pilot_enabled"] },
  { label: "Pilot window active", keys: ["gate_pilot_window_active", "pilot_window_active"] },
  { label: "Symbol allowed", keys: ["gate_symbol_allowed", "symbol_allowed"] },
  { label: "Time gate", keys: ["time_gate_status", "gate_time"] },
  { label: "Market open", keys: ["market_open", "gate_market_open"] },
  { label: "Spread OK", keys: ["gate_spread_ok", "spread_ok"] },
  { label: "Max open trades OK", keys: ["gate_max_open_trades_ok"] },
  { label: "Max trades/day OK", keys: ["gate_max_trades_per_day_ok"] },
  { label: "Daily loss OK", keys: ["gate_daily_loss_ok"] },
  { label: "Consecutive losses OK", keys: ["gate_consecutive_losses_ok"] },
  { label: "Kelly lot valid", keys: ["gate_kelly_lot_valid", "kelly_lot_valid"] },
  { label: "Final lot ≤ 0.01", keys: ["gate_final_lot_ok", "final_lot_ok"] },
  { label: "Risk ≤ 0.25%", keys: ["gate_risk_ok"] },
  { label: "SL/TP valid", keys: ["gate_sl_tp_valid", "sl_tp_valid"] },
  { label: "RR ≥ 1.5", keys: ["gate_rr_ok", "rr_ok"] },
  { label: "Safety Guard PASS", keys: ["safety_guard_status"] },
  { label: "MTFA not FAIL", keys: ["mtfa_status"], truthy: ["PASS", "OK", "NEUTRAL", "CAUTION"] },
  { label: "SMC PASS", keys: ["smc_confluence_status", "smc_status"] },
  { label: "M15 confirmation", keys: ["m15_confirmation", "m15_confirmation_pass"] },
  { label: "M1 confirmation", keys: ["m1_confirmation", "m1_confirmation_pass"] },
  { label: "Big Setup grade ≥ B", keys: ["big_setup_grade"], truthy: ["A+", "A", "B"] },
  { label: "Strategy allowed for entry", keys: ["gate_strategy_allowed", "strategy_entry_allowed"] },
];

export function DemoGateChecklist() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = getRP(d);
  return (
    <Panel title="DEMO GATE CHECKLIST" right={d ? `${d.symbol ?? ""} ${d.timeframe ?? ""}` : "—"}>
      {!d ? <Waiting label="WAITING FOR LATEST SIGNAL" /> : (
        <div className="grid grid-cols-2 gap-x-3">
          {GATE_KEYS.map((g) => {
            let val: any = undefined;
            for (const k of g.keys) {
              const v = rp[k] ?? d[k];
              if (v != null) { val = v; break; }
            }
            let res: GateResult;
            if (val == null) res = "UNKNOWN";
            else if (g.truthy) res = g.truthy.includes(String(val).toUpperCase()) ? "PASS" : "FAIL";
            else res = boolGate(val);
            return (
              <div key={g.label} className="flex items-center justify-between border-b border-dashed border-black/30 py-0.5">
                <span className="text-[10px] uppercase">{g.label}</span>
                <Badge value={res} tone={gateTone(res) as any} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ============ KELLY DEMO PANEL ============
export function KellyDemoPanel() {
  const { rows } = useLiveTable<any>("kelly_risk", { limit: 1 });
  const k = rows[0];
  const rp = getRP(k);
  const sources = [rp, k ?? {}];

  const kellySuggested = getField(sources, "kelly_suggested_lot") ?? getField(sources, "suggested_lot") ?? getField(sources, "raw_lot");
  const rawLot = getField(sources, "raw_lot") ?? getField(sources, "calculated_lot") ?? getField(sources, "theoretical_lot");
  const finalCapped = getField(sources, "final_capped_lot") ?? getField(sources, "demo_capped_lot") ?? k?.lot_size;
  const riskPct = getField(sources, "final_risk") ?? getField(sources, "risk_pct") ?? k?.final_risk;
  const capReason = getField(sources, "cap_reason") ?? getField(sources, "demo_cap_reason");
  const decision = getField(sources, "kelly_demo_decision") ?? getField(sources, "kelly_decision") ?? k?.status;
  const blockReason = getField(sources, "kelly_block_reason") ?? k?.blocked_reason;

  const cappedNum = Number(finalCapped ?? 0);
  const overCap = cappedNum > DEMO_MAX_LOT;
  const decisionTone = String(decision ?? "").toUpperCase() === "PASS" ? "green" : String(decision ?? "").toUpperCase().includes("BLOCK") ? "red" : "gray";

  return (
    <Panel title="KELLY DEMO ROUTER" right={`MAX LOT ${DEMO_MAX_LOT} · MAX RISK ${DEMO_MAX_RISK_PCT}%`}>
      {!k ? <Waiting label="WAITING FOR KELLY DECISION" /> : (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <KV k="Kelly Suggested Lot" v={kellySuggested != null ? Number(kellySuggested).toFixed(4) : UNK} />
            <KV k="Theoretical Raw Lot" v={rawLot != null ? Number(rawLot).toFixed(4) : UNK} />
            <KV k="Final Capped Lot" v={finalCapped != null ? Number(finalCapped).toFixed(4) : UNK} accent={overCap ? "loss" : "profit"} />
            <KV k="Max Lot Cap" v={DEMO_MAX_LOT.toFixed(2)} />
            <KV k="Risk %" v={riskPct != null ? `${riskPct}%` : UNK} />
            <KV k="Cap Reason" v={String(u(capReason))} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge value={`KELLY: ${u(decision)}`} tone={decisionTone as any} />
            {overCap && <Badge value="⚠ FINAL LOT EXCEEDS DEMO CAP" tone="red" />}
          </div>
          {blockReason && <div className="mt-1 text-[10px] opacity-80"><b>BLOCK:</b> {String(blockReason)}</div>}
          <div className="mt-2 border border-dashed border-black/60 p-1 text-[10px] uppercase tracking-widest text-center">
            ⚠ RAW KELLY LOT IS NOT EXECUTABLE. FINAL CAPPED LOT IS THE ONLY EXECUTABLE LOT.
          </div>
        </>
      )}
    </Panel>
  );
}

// ============ TIME ENGINE ============
export function TimeEnginePanel() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = getRP(d);
  const utc = new Date().toISOString().slice(11, 19);
  const casa = new Date(Date.now() + 1 * 3600 * 1000).toISOString().slice(11, 19); // Casablanca = UTC+1
  return (
    <Panel title="TIME ENGINE" right="UTC · CASA · BROKER">
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="UTC" v={utc} />
        <KV k="Casablanca" v={casa} />
        <KV k="Broker Time Est." v={String(u(rp.broker_time))} />
        <KV k="Broker UTC Offset" v={String(u(rp.broker_utc_offset))} />
        <KV k="Session" v={String(u(rp.session))} />
        <KV k="Market Open" v={String(u(rp.market_open))} />
        <KV k="Weekend" v={String(u(rp.is_weekend ?? rp.safety_guard_is_weekend))} />
        <KV k="Bad Hour" v={String(u(rp.bad_hour))} />
        <KV k="Time Gate Status" v={String(u(rp.time_gate_status))} />
      </div>
      <div className="mt-1 text-[10px] opacity-80"><b>TIME GATE REASON:</b> {String(u(rp.time_gate_reason))}</div>
    </Panel>
  );
}

// ============ SMC / MTFA / MTF STRUCTURE ============
export function SmcMtfaPanel() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = getRP(d);
  return (
    <Panel title="SMC · MTFA · MTF STRUCTURE" right={d ? `${d.symbol ?? ""} ${d.timeframe ?? ""}` : "—"}>
      {!d ? <Waiting /> : (
        <div className="grid grid-cols-2 gap-x-3">
          <KV k="Direction" v={String(u(rp.direction ?? d.signal))} />
          <KV k="SMC Score" v={String(u(rp.smc_confluence_score ?? rp.smc_score))} />
          <KV k="SMC Status" v={String(u(rp.smc_confluence_status ?? rp.smc_status))} />
          <KV k="MTFA Status" v={String(u(rp.mtfa_status))} />
          <KV k="MTF Structure" v={String(u(rp.mtf_structure_status))} />
          <KV k="H4 Bias" v={String(u(rp.h4_bias ?? rp.smc_h4_direction))} />
          <KV k="H4 Zone" v={String(u(rp.h4_zone))} />
          <KV k="H1 Trend" v={String(u(rp.h1_trend))} />
          <KV k="M15 Confirmation" v={String(u(rp.m15_confirmation))} />
          <KV k="M1 Confirmation" v={String(u(rp.m1_confirmation))} />
        </div>
      )}
      {d && (
        <div className="mt-1 text-[10px] opacity-80 space-y-0.5">
          <div><b>SMC REASON:</b> {String(u(rp.smc_confluence_reason ?? rp.smc_reason))}</div>
          <div><b>MTFA REASON:</b> {String(u(rp.mtfa_reason))}</div>
          <div><b>MTF REASON:</b> {String(u(rp.mtf_structure_reason))}</div>
        </div>
      )}
    </Panel>
  );
}

// ============ TRADE JOURNAL TABS ============
type Tab = "DEMO" | "PAPER" | "HIST_PAPER";

export function TradeJournalTabs() {
  const [tab, setTab] = React.useState<Tab>("DEMO");
  const { rows } = useLiveTable<any>("trades", { limit: 200 });

  const filtered = React.useMemo(() => {
    return rows.filter((t) => {
      const rp = getRP(t);
      const magic = t.magic_number ?? t.magic ?? rp.magic_number ?? rp.magic;
      const mode = String(rp.mode ?? t.signal ?? "").toUpperCase();
      const comment = String(rp.comment ?? "").toUpperCase();
      if (tab === "DEMO") {
        return Number(magic) === DEMO_MAGIC || mode === "DEMO" || comment.includes("DEMO_KELLY");
      }
      if (tab === "PAPER") {
        const isPaper = Number(magic) === 909001 || mode === "PAPER";
        const isOpen = !t.closed_at && (t.result == null);
        return isPaper && isOpen;
      }
      // HIST_PAPER
      const isPaper = Number(magic) === 909001 || mode === "PAPER";
      return isPaper && (t.closed_at != null || t.result != null);
    });
  }, [rows, tab]);

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.opened_at ?? a.created_at).getTime();
    const tb = new Date(b.opened_at ?? b.created_at).getTime();
    return tb - ta;
  }).slice(0, 30);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "DEMO", label: "DEMO TRADES (909002)", count: rows.filter(t => Number(t.magic_number ?? t.magic) === DEMO_MAGIC).length },
    { id: "PAPER", label: "PAPER TRADES (909001 OPEN)", count: rows.filter(t => Number(t.magic_number ?? t.magic) === 909001 && !t.closed_at).length },
    { id: "HIST_PAPER", label: "HISTORICAL PAPER", count: rows.filter(t => Number(t.magic_number ?? t.magic) === 909001 && t.closed_at).length },
  ];

  return (
    <Panel title="TRADE JOURNALS" right={`${sorted.length} ROWS`}>
      <div className="flex border-b border-black mb-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest border-r border-black ${tab === tb.id ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"}`}
          >
            {tb.label} · {tb.count}
          </button>
        ))}
      </div>
      {sorted.length === 0 ? <Waiting label={`NO ${tab} TRADES`} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black text-left uppercase tracking-wider">
                {["Time","Ticket","Magic","Sym","Dir","Entry","SL","TP","Lot","PnL","Strategy","RR","Kelly Sug.","Final Cap","Gate","Status","Close Reason"].map(h => (
                  <th key={h} className="py-1 pr-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const rp = getRP(t);
                const ks = rp.kelly_suggested_lot ?? rp.raw_lot;
                const fc = rp.final_capped_lot ?? rp.demo_capped_lot ?? t.lot ?? t.lot_size;
                const fcNum = Number(fc ?? 0);
                const overCap = tab === "DEMO" && fcNum > DEMO_MAX_LOT;
                const gate = rp.demo_gate_decision ?? rp.gate_status ?? UNK;
                const status = t.closed_at ? "CLOSED" : (rp.status ?? "OPEN");
                return (
                  <tr key={t.id} className="border-b border-dashed border-black/40">
                    <td className="py-1 pr-2 pixel">{new Date(t.opened_at ?? t.created_at).toISOString().slice(11, 19)}</td>
                    <td className="pr-2">{t.ticket ?? "—"}</td>
                    <td className="pr-2">{t.magic ?? t.magic_number ?? "—"}</td>
                    <td className="pr-2">{t.symbol}</td>
                    <td className="pr-2">{t.dir}</td>
                    <td className="pr-2 pixel">{t.entry ?? "—"}</td>
                    <td className="pr-2 pixel text-loss">{t.sl ?? "—"}</td>
                    <td className="pr-2 pixel text-profit">{t.tp ?? "—"}</td>
                    <td className="pr-2">{t.lot ?? t.lot_size ?? "—"}</td>
                    <td className={`pr-2 pixel ${(t.pnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>{(t.pnl ?? 0) >= 0 ? "+" : ""}{t.pnl ?? 0}</td>
                    <td className="pr-2">{t.strategy ?? "—"}</td>
                    <td className="pr-2">{rp.rr ?? rp.reward_risk ?? "—"}</td>
                    <td className="pr-2">{ks != null ? Number(ks).toFixed(4) : "—"}</td>
                    <td className={`pr-2 ${overCap ? "text-loss font-bold" : ""}`}>{fc != null ? Number(fc).toFixed(4) : "—"}</td>
                    <td className="pr-2"><Badge value={String(gate)} tone={statusTone(String(gate))} /></td>
                    <td className="pr-2">{status}</td>
                    <td className="pr-2 italic opacity-80">{t.reason ?? rp.close_reason ?? ""}</td>
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

// ============ DEMO REPORT ============
export function DemoReport() {
  const { rows: trades } = useLiveTable<any>("trades", { limit: 200 });
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 50 });

  const demo = trades.filter((t) => {
    const rp = getRP(t);
    const magic = t.magic_number ?? t.magic ?? rp.magic_number;
    return Number(magic) === DEMO_MAGIC;
  });

  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: string | null | undefined) => d?.slice(0, 10) === today;

  const openedToday = demo.filter(t => isToday(t.opened_at ?? t.created_at)).length;
  const closedToday = demo.filter(t => isToday(t.closed_at)).length;
  const openNow = demo.filter(t => !t.closed_at).length;
  const pnlToday = demo.filter(t => isToday(t.closed_at)).reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  const wins = demo.filter(t => Number(t.pnl ?? 0) > 0).length;
  const losses = demo.filter(t => Number(t.pnl ?? 0) < 0).length;
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : UNK;

  // consecutive losses (latest closed sequence)
  let consec = 0;
  const closedSorted = demo.filter(t => t.closed_at).sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
  for (const t of closedSorted) { if (Number(t.pnl ?? 0) < 0) consec++; else break; }

  const byStrat: Record<string, number> = {};
  for (const t of demo) {
    if (!t.strategy) continue;
    byStrat[t.strategy] = (byStrat[t.strategy] ?? 0) + Number(t.pnl ?? 0);
  }
  const sortedStrat = Object.entries(byStrat).sort((a, b) => b[1] - a[1]);
  const bestStrat = sortedStrat[0]?.[0] ?? UNK;
  const worstStrat = sortedStrat[sortedStrat.length - 1]?.[0] ?? UNK;

  const skipReasons: Record<string, number> = {};
  for (const d of dec) {
    if (String(d.decision ?? "").toUpperCase() === "SKIP") {
      const r = d.blocked_reason ?? d.reason ?? "—";
      skipReasons[r] = (skipReasons[r] ?? 0) + 1;
    }
  }

  const lastKelly = getField([getRP(dec[0]), dec[0] ?? {}], "kelly_demo_decision") ?? getField([getRP(dec[0]), dec[0] ?? {}], "kelly_decision") ?? UNK;
  const liveOrdersDetected = trades.some((t) => {
    const rp = getRP(t);
    return rp.mode && String(rp.mode).toUpperCase() === "LIVE";
  });

  return (
    <Panel title="DEMO REPORT" right="MAGIC 909002">
      <div className="grid grid-cols-4 gap-2 text-center">
        <div><div className="text-[9px] uppercase opacity-70">Opened Today</div><div className="pixel text-[18px]">{openedToday}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Closed Today</div><div className="pixel text-[18px]">{closedToday}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Open Now</div><div className="pixel text-[18px]">{openNow}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">PnL Today</div><div className={`pixel text-[18px] ${pnlToday >= 0 ? "text-profit" : "text-loss"}`}>{pnlToday >= 0 ? "+" : ""}{pnlToday.toFixed(2)}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Win Rate</div><div className="pixel text-[18px]">{winRate}{winRate !== UNK && "%"}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Consec. Losses</div><div className={`pixel text-[18px] ${consec >= 3 ? "text-loss" : ""}`}>{consec}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Best Strategy</div><div className="text-[11px] font-bold">{bestStrat}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Worst Strategy</div><div className="text-[11px] font-bold">{worstStrat}</div></div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="font-bold uppercase opacity-70">Skipped Count by Reason</div>
          {Object.entries(skipReasons).slice(0, 6).map(([k, v]) => <div key={k}>{v}× {k}</div>)}
          {Object.keys(skipReasons).length === 0 && <div className="opacity-60">—</div>}
        </div>
        <div>
          <KV k="Last Kelly Decision" v={String(lastKelly)} />
          <KV k="Live Orders Detected" v={liveOrdersDetected ? "TRUE ⚠" : "false"} accent={liveOrdersDetected ? "loss" : "profit"} />
        </div>
      </div>
    </Panel>
  );
}

// ============ ALERTS ============
export function DemoAlerts() {
  const { rows: status } = useLiveTable<any>("bot_status", { limit: 5 });
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 5 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 50 });

  const bsRP = getRP(status[0]);
  const decRP = getRP(dec[0]);
  const sources = [bsRP, status[0] ?? {}, decRP, dec[0] ?? {}];

  const accountType = String(getField(sources, "account_type") ?? "").toUpperCase();
  const demoPilotEnabled = getField(sources, "demo_pilot_enabled");
  const allowLive = getField(sources, "allow_live_trading");

  const alerts: string[] = [];
  if (demoPilotEnabled && accountType && accountType !== "DEMO") alerts.push(`account_type=${accountType} while demo_pilot_enabled=true`);
  if (allowLive === true) alerts.push("allow_live_trading = true");

  // final lot > 0.01 on demo trades
  for (const t of trades) {
    const rp = getRP(t);
    const magic = t.magic_number ?? t.magic ?? rp.magic_number;
    if (Number(magic) === DEMO_MAGIC) {
      const lot = Number(t.lot ?? t.lot_size ?? 0);
      if (lot > DEMO_MAX_LOT) { alerts.push(`Demo trade ticket ${t.ticket ?? "?"} lot ${lot} > ${DEMO_MAX_LOT}`); break; }
    }
  }

  // demo order data with wrong magic
  for (const t of trades) {
    const rp = getRP(t);
    if (String(rp.mode ?? "").toUpperCase() === "DEMO") {
      const magic = t.magic_number ?? t.magic ?? rp.magic_number;
      if (Number(magic) !== DEMO_MAGIC) { alerts.push(`Demo order with magic ${magic} (expected ${DEMO_MAGIC})`); break; }
    }
  }

  if (decRP.smc_confluence_status && String(decRP.smc_confluence_status).toUpperCase() === "FAIL") alerts.push("SMC FAIL on latest signal");
  if (decRP.mtfa_status && String(decRP.mtfa_status).toUpperCase() === "FAIL") alerts.push("MTFA FAIL on latest signal");
  if (decRP.safety_guard_status && String(decRP.safety_guard_status).toUpperCase() !== "PASS") alerts.push(`Safety Guard = ${decRP.safety_guard_status}`);
  if (decRP.m1_confirmation === false) alerts.push("Missing M1 confirmation");
  if (decRP.order_send_attempted_outside_demo_router) alerts.push("order_send attempted outside demo router");

  return (
    <Panel title="ALERTS" right={`${alerts.length}`}>
      {alerts.length === 0 ? (
        <div className="text-[11px] text-profit uppercase tracking-widest text-center py-2">✓ NO ACTIVE ALERTS</div>
      ) : (
        <ul className="space-y-1">
          {alerts.map((a, i) => (
            <li key={i} className="bg-red-600 text-white px-2 py-1 text-[11px] uppercase tracking-wider">⚠ {a}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ============ MISSING FIELDS ============
const REQUIRED_FIELDS: Array<{ name: string; source: string; lookup: (ctx: any) => any }> = [
  { name: "demo_pilot_enabled", source: "bot_status.raw_payload", lookup: (c) => getField([c.bsRP, c.bs], "demo_pilot_enabled") },
  { name: "demo_trading", source: "bot_status", lookup: (c) => getField([c.bsRP, c.bs], "demo_trading") },
  { name: "demo_only", source: "bot_status.raw_payload", lookup: (c) => getField([c.bsRP, c.bs], "demo_only") },
  { name: "allow_live_trading", source: "bot_status", lookup: (c) => getField([c.bsRP, c.bs], "allow_live_trading") },
  { name: "account_type", source: "bot_status / account_snapshots", lookup: (c) => getField([c.bsRP, c.bs, c.snapRP, c.snap], "account_type") },
  { name: "mt5_connected", source: "bot_status", lookup: (c) => getField([c.bsRP, c.bs], "mt5_connected") },
  { name: "pilot_started_at", source: "bot_status.raw_payload", lookup: (c) => getField([c.bsRP], "pilot_started_at") ?? getField([c.bsRP], "demo_pilot_started_at") },
  { name: "pilot_expires_at", source: "bot_status.raw_payload", lookup: (c) => getField([c.bsRP], "pilot_expires_at") ?? getField([c.bsRP], "demo_pilot_expires_at") },
  { name: "last_demo_gate_decision", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP, c.dec], "last_demo_gate_decision") ?? getField([c.decRP], "demo_gate_decision") },
  { name: "kelly_suggested_lot", source: "kelly_risk.raw_payload", lookup: (c) => getField([c.kRP, c.k], "kelly_suggested_lot") ?? getField([c.kRP], "raw_lot") },
  { name: "final_capped_lot", source: "kelly_risk.raw_payload", lookup: (c) => getField([c.kRP, c.k], "final_capped_lot") ?? c.k?.lot_size },
  { name: "m1_confirmation", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP], "m1_confirmation") },
  { name: "m15_confirmation", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP], "m15_confirmation") },
  { name: "smc_confluence_status", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP], "smc_confluence_status") ?? getField([c.decRP], "smc_status") },
  { name: "mtfa_status", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP], "mtfa_status") },
  { name: "safety_guard_status", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP], "safety_guard_status") },
  { name: "time_gate_status", source: "ai_decisions.raw_payload", lookup: (c) => getField([c.decRP], "time_gate_status") },
];

export function MissingFieldsPanel() {
  const { rows: bsRows } = useLiveTable<any>("bot_status", { limit: 1 });
  const { rows: snapRows } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const { rows: decRows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: kRows } = useLiveTable<any>("kelly_risk", { limit: 1 });
  const ctx = {
    bs: bsRows[0] ?? {}, bsRP: getRP(bsRows[0]),
    snap: snapRows[0] ?? {}, snapRP: getRP(snapRows[0]),
    dec: decRows[0] ?? {}, decRP: getRP(decRows[0]),
    k: kRows[0] ?? {}, kRP: getRP(kRows[0]),
  };

  const missing = REQUIRED_FIELDS.filter((f) => f.lookup(ctx) == null);

  return (
    <Panel title="MISSING BACKEND FIELDS" right={`${missing.length} MISSING`}>
      {missing.length === 0 ? (
        <div className="text-[11px] text-profit uppercase tracking-widest text-center py-2">✓ ALL REQUIRED FIELDS PRESENT</div>
      ) : (
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-black text-left uppercase tracking-wider">
              <th className="py-1">Field</th><th>Expected Source</th><th>Current Value</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((f) => (
              <tr key={f.name} className="border-b border-dashed border-black/40">
                <td className="py-1 pr-2 font-bold">{f.name}</td>
                <td className="pr-2 opacity-80">{f.source}</td>
                <td className="pr-2"><Badge value={UNK} tone="gray" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
