import * as React from "react";
import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSymbol } from "@/lib/symbol";

const DEMO_SYMBOLS = ["GOLD#", "GOLD", "BTCUSD#", "BTCUSD", "EURUSD"];

function useDemoTrades(heartbeatKey?: string) {
  const [rows, setRows] = React.useState<any[]>([]);
  const load = React.useCallback(async () => {
    const { data } = await supabase
      .from("trades" as any)
      .select("*")
      .eq("magic_number", 909002)
      .order("opened_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as any[]);
  }, []);
  React.useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const ch = supabase
      .channel(`demo-trades:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => load())
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [load]);
  React.useEffect(() => {
    load();
  }, [heartbeatKey, load]);
  return { rows };
}

function isClosedTrade(t: any): boolean {
  const rp = (t?.raw_payload ?? {}) as any;
  const result = String(t?.result ?? "").toUpperCase();
  const rpStatus = String(rp?.status ?? "").toUpperCase();
  return result === "CLOSED" || t?.closed_at != null || rpStatus === "CLOSED";
}

function isOpenDemo(t: any): boolean {
  if (Number(t?.magic_number) !== 909002) return false;
  if (String(t?.result ?? "").toUpperCase() !== "OPEN") return false;
  if (t?.closed_at != null) return false;
  return true;
}

function isHistDemo(t: any): boolean {
  if (Number(t?.magic_number) !== 909002) return false;
  return String(t?.result ?? "").toUpperCase() === "CLOSED";
}

const DEMO_MAGIC = 909002;
const DEMO_COMMENT = "HERMES_DEMO_KELLY_24H";
const DEMO_MAX_LOT = 0.01;
const DEMO_MAX_RISK_PCT = 0.25;
const DEMO_HOURS_DEFAULT = 48;

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

/**
 * Single source of truth for the dashboard.
 * Reads the latest bot_status row where component='dashboard_status'
 * and returns the merged inner payload (payload | status_json | raw_payload).
 * If a key is missing here, callers may fall back to other sources, but
 * dashboard_status ALWAYS takes priority.
 */
export function useDashboardStatusPayload(): Record<string, any> {
  const { rows } = useLiveTable<any>("bot_status", {
    orderBy: "updated_at",
    ascending: false,
    limit: 1,
    filter: { column: "component", value: "dashboard_status" },
  });
  const row = rows[0];
  if (!row) return {};
  const rp = (row.raw_payload ?? {}) as Record<string, any>;
  const inner =
    (rp.payload as Record<string, any> | undefined) ??
    (rp.status_json as Record<string, any> | undefined) ??
    (rp.raw_payload as Record<string, any> | undefined) ??
    {};
  // Keep row metadata (updated_at/status/component) available for health checks,
  // then let raw payload and inner payload fields override/extend it.
  return { ...row, ...rp, ...inner };
}

function formatMode(raw: any): string {
  if (raw == null || raw === "") return UNKNOWN_MODE_FALLBACK;
  return String(raw).replace(/_/g, " ").toUpperCase();
}
const UNKNOWN_MODE_FALLBACK = UNK;

type GateResult = "PASS" | "FAIL" | "UNKNOWN";
function gateTone(s: GateResult) {
  return s === "PASS" ? "green" : s === "FAIL" ? "red" : "gray";
}
function boolGate(v: any): GateResult {
  if (v == null) return "UNKNOWN";
  if (
    v === true ||
    String(v).toUpperCase() === "PASS" ||
    String(v).toUpperCase() === "OK" ||
    String(v).toUpperCase() === "TRUE"
  )
    return "PASS";
  if (
    v === false ||
    String(v).toUpperCase() === "FAIL" ||
    String(v).toUpperCase() === "BLOCK" ||
    String(v).toUpperCase() === "BLOCKED" ||
    String(v).toUpperCase() === "FALSE"
  )
    return "FAIL";
  return "UNKNOWN";
}

// ============ HEADER MODE BANNER ============
export function DemoModeBanner() {
  const ds = useDashboardStatusPayload();
  const { rows: status } = useLiveTable<any>("bot_status", {
    orderBy: "updated_at",
    ascending: false,
    limit: 5,
  });
  const bs = status[0] ?? {};
  const bsRP = getRP(bs);

  // dashboard_status ALWAYS wins. Old account snapshots are NOT consulted here.
  const sources = [ds, bsRP, bs];
  const demoPilotEnabled = getField(sources, "demo_pilot_enabled");
  const demoTrading = getField(sources, "demo_trading");
  const demoOnly = getField(sources, "demo_only");
  const paperTrading = getField(sources, "paper_trading");
  const allowLive = getField(sources, "allow_live_trading");
  const liveBlocked = getField(sources, "live_trading_blocked");
  const accountType = String(getField(sources, "account_type") ?? "").toUpperCase();
  const magic = getField(sources, "demo_magic_number") ?? getField(sources, "magic_number");
  const comment = getField(sources, "demo_comment");
  const modeRaw = getField(sources, "mode");

  const pilotHoursBanner = Number(
    getField(sources, "demo_pilot_hours") ??
      getField(sources, "pilot_hours_total") ??
      getField(sources, "demo_pilot_hours_total") ??
      DEMO_HOURS_DEFAULT,
  );
  const mode = modeRaw
    ? formatMode(modeRaw)
    : demoPilotEnabled
      ? `DEMO PILOT ${pilotHoursBanner}H`
      : demoTrading
        ? "DEMO"
        : paperTrading
          ? "PAPER"
          : allowLive
            ? "LIVE"
            : UNK;

  const accountBadge =
    accountType === "DEMO" ? "DEMO VERIFIED" : accountType === "LIVE" ? "LIVE BLOCKED" : UNK;

  // Live-trading display: prefer explicit live_trading_blocked from backend,
  // then fall back to allow_live_trading.
  const liveTradingText =
    liveBlocked === true
      ? "BLOCKED"
      : liveBlocked === false
        ? "ALLOWED ⚠"
        : allowLive == null
          ? UNK
          : allowLive
            ? "ALLOWED ⚠"
            : "BLOCKED";
  const liveTradingDanger = liveBlocked === false || allowLive === true;

  const liveAccountAlert = accountType === "LIVE" && demoPilotEnabled === true;
  const liveTradingAlert = allowLive === true;

  return (
    <div className="border-2 border-black mt-3">
      <div className="bg-foreground text-background px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest font-bold">
        <span>
          MODE: <span className="pixel text-[14px]">{mode}</span>
        </span>
        <span>
          LIVE TRADING:{" "}
          <span className={liveTradingDanger ? "text-red-400" : ""}>{liveTradingText}</span>
        </span>
        <span>DEMO ONLY: {demoOnly == null ? UNK : demoOnly ? "TRUE" : "FALSE"}</span>
        <span>ACCOUNT TYPE: {accountBadge}</span>
        <span>MAGIC: {magic ?? UNK}</span>
        <span>COMMENT: {comment ?? UNK}</span>
      </div>
      {liveAccountAlert && (
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
  const ds = useDashboardStatusPayload();
  const { rows: status } = useLiveTable<any>("bot_status", {
    orderBy: "updated_at",
    ascending: false,
    limit: 5,
  });
  const bs = status[0] ?? {};
  const bsRP = getRP(bs);
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 5 });
  const decRP = getRP(dec[0]);

  // dashboard_status wins; do not consult account_snapshots for these fields.
  const sources = [ds, bsRP, bs, decRP];
  const demoPilotEnabled = getField(sources, "demo_pilot_enabled");
  const demoTrading = getField(sources, "demo_trading");
  const demoOnly = getField(sources, "demo_only");
  const paperTrading = getField(sources, "paper_trading");
  const allowLive = getField(sources, "allow_live_trading");
  const pilotStartedAt =
    getField(sources, "pilot_started_at") ?? getField(sources, "demo_pilot_started_at");
  const pilotExpiresAt =
    getField(sources, "pilot_expires_at") ?? getField(sources, "demo_pilot_expires_at");
  let hoursRemaining =
    getField(sources, "pilot_hours_remaining") ?? getField(sources, "demo_pilot_hours_remaining");
  if (hoursRemaining == null && pilotExpiresAt) {
    const ms = new Date(pilotExpiresAt).getTime() - Date.now();
    if (!isNaN(ms)) hoursRemaining = Math.max(0, ms / 3600000).toFixed(2);
  }
  const accountType = getField(sources, "account_type");
  const comment = getField(sources, "demo_comment");
  const mt5 = getField(sources, "mt5_connected");
  const lastGateDec =
    getField([ds, bsRP, bs, decRP, dec[0]], "latest_demo_gate_decision") ??
    getField([ds, bsRP, bs, decRP, dec[0]], "last_demo_gate_decision") ??
    getField([decRP, dec[0]], "demo_gate_decision");
  const lastGateReason =
    getField([ds, bsRP, bs, decRP, dec[0]], "latest_demo_gate_reason") ??
    getField([decRP, dec[0]], "last_demo_gate_reason") ??
    getField([decRP, dec[0]], "demo_gate_reason");
  const latestStrategyGateReason = getField(
    [ds, bsRP, bs, decRP, dec[0]],
    "latest_strategy_gate_reason",
  );
  const latestStrategyGateSymbol = getField(
    [ds, bsRP, bs, decRP, dec[0]],
    "latest_strategy_gate_symbol",
  );
  const latestStrategyGateStrategy = getField(
    [ds, bsRP, bs, decRP, dec[0]],
    "latest_strategy_gate_strategy",
  );
  const latestStrategyGateDecision = getField(
    [ds, bsRP, bs, decRP, dec[0]],
    "latest_strategy_gate_decision",
  );
  const latestSymbolGateReason = getField(
    [ds, bsRP, bs, decRP, dec[0]],
    "latest_symbol_gate_reason",
  );
  const lastDemoTicket = getField([decRP, dec[0], bsRP, bs], "last_demo_ticket");
  const gateMissing = lastGateDec == null || lastGateDec === "";
  const gateDecDisplay = gateMissing
    ? "UNKNOWN — backend did not emit latest gate field"
    : String(lastGateDec);

  const pilotHoursConfigured = Number(
    getField(sources, "demo_pilot_hours") ??
      getField(sources, "pilot_hours_total") ??
      getField(sources, "demo_pilot_hours_total") ??
      DEMO_HOURS_DEFAULT,
  );
  return (
    <Panel title="DEMO PILOT STATUS" right={`${pilotHoursConfigured}H KELLY ROUTER`}>
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="demo_pilot_enabled" v={String(u(demoPilotEnabled))} />
        <KV k="demo_trading" v={String(u(demoTrading))} />
        <KV k="demo_only" v={String(u(demoOnly))} />
        <KV k="paper_trading" v={String(u(paperTrading))} />
        <KV
          k="allow_live_trading"
          v={String(u(allowLive))}
          accent={allowLive ? "loss" : undefined}
        />
        <KV k="account_type" v={String(u(accountType))} />
        <KV k="demo_comment" v={String(u(comment))} />
        <KV k="mt5_connected" v={String(u(mt5))} />
        <KV
          k="pilot_started_at"
          v={
            pilotStartedAt
              ? new Date(pilotStartedAt).toISOString().slice(0, 19).replace("T", " ")
              : UNK
          }
        />
        <KV
          k="pilot_expires_at"
          v={
            pilotExpiresAt
              ? new Date(pilotExpiresAt).toISOString().slice(0, 19).replace("T", " ")
              : UNK
          }
        />
        <KV
          k="pilot_hours_remaining"
          v={hoursRemaining != null ? `${hoursRemaining} / ${pilotHoursConfigured}h` : UNK}
        />
        <KV
          k="latest_demo_gate_decision"
          v={gateDecDisplay}
          accent={gateMissing ? "loss" : undefined}
        />
        <KV k="last_demo_ticket" v={String(u(lastDemoTicket))} />
      </div>
      <div className="mt-1 text-[10px] opacity-80">
        <b>LATEST DEMO GATE REASON:</b> {String(u(lastGateReason))}
      </div>
      <div className="text-[10px] opacity-80">
        <b>LATEST STRATEGY GATE:</b> {String(u(latestStrategyGateSymbol))} /{" "}
        {String(u(latestStrategyGateStrategy))} — {String(u(latestStrategyGateDecision))} —{" "}
        {String(u(latestStrategyGateReason))}
      </div>
      <div className="text-[10px] opacity-80">
        <b>LATEST SYMBOL GATE:</b> {String(u(latestSymbolGateReason))}
      </div>
      {gateMissing && (
        <div className="mt-1 text-[10px] text-loss uppercase tracking-widest">
          ⚠ Do not infer PASS from Safety Guard alone — backend gate field is missing.
        </div>
      )}
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
  {
    label: "M15 confirmation",
    keys: ["m15_confirmation", "m15_confirmation_pass", "m15_entry_confirmation"],
  },
  {
    label: "M1 confirmation",
    keys: ["m1_confirmation", "m1_confirmation_pass", "m1_entry_confirmation", "m1_trigger_status"],
  },
  { label: "Big Setup grade ≥ B", keys: ["big_setup_grade"], truthy: ["A+", "A", "B"] },
  {
    label: "Strategy allowed for entry",
    keys: ["gate_strategy_allowed", "strategy_entry_allowed"],
  },
];

export function DemoGateChecklist() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = getRP(d);
  const gateStatuses = (rp.gate_statuses ?? {}) as Record<string, any>;
  return (
    <Panel title="DEMO GATE CHECKLIST" right={d ? `${d.symbol ?? ""} ${d.timeframe ?? ""}` : "—"}>
      {!d ? (
        <Waiting label="WAITING FOR LATEST SIGNAL" />
      ) : (
        <div className="grid grid-cols-2 gap-x-3">
          {GATE_KEYS.map((g) => {
            let val: any = undefined;
            for (const k of g.keys) {
              const v = rp[k] ?? gateStatuses[k] ?? d[k];
              if (v != null && v !== "") {
                val = v;
                break;
              }
            }
            let res: GateResult;
            if (val == null) res = "UNKNOWN";
            else if (g.truthy) res = g.truthy.includes(String(val).toUpperCase()) ? "PASS" : "FAIL";
            else res = boolGate(val);
            return (
              <div
                key={g.label}
                className="flex items-center justify-between border-b border-dashed border-black/30 py-0.5"
              >
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
  const gateStatuses = (rp as any)?.gate_statuses ?? {};

  const kellySuggested =
    getField(sources, "kelly_suggested_lot") ??
    getField(sources, "suggested_lot") ??
    getField(sources, "raw_lot");
  const rawLot =
    getField(sources, "raw_lot") ??
    getField(sources, "calculated_lot") ??
    getField(sources, "theoretical_lot") ??
    kellySuggested;

  // Final capped lot = backend-provided cap. Never display raw lot here.
  // Priority: final_capped_lot → gate_statuses.final_lot → DEMO_MAX_LOT (hard cap).
  const backendFinalCap =
    getField(sources, "final_capped_lot") ??
    getField(sources, "demo_capped_lot") ??
    gateStatuses?.final_lot;
  const finalCappedDisplay =
    backendFinalCap != null ? Math.min(Number(backendFinalCap), DEMO_MAX_LOT) : DEMO_MAX_LOT;

  const riskPct = getField(sources, "final_risk") ?? getField(sources, "risk_pct") ?? k?.final_risk;
  const capReason = getField(sources, "cap_reason") ?? getField(sources, "demo_cap_reason");
  const decision =
    getField(sources, "kelly_demo_decision") ?? getField(sources, "kelly_decision") ?? k?.status;
  const blockReason = getField(sources, "kelly_block_reason") ?? k?.blocked_reason;

  // Warning only if the backend-reported final cap itself exceeds DEMO_MAX_LOT.
  // Raw Kelly lot being > 0.01 is expected and NOT a warning.
  const backendCapNum = backendFinalCap != null ? Number(backendFinalCap) : null;
  const overCap = backendCapNum != null && backendCapNum > DEMO_MAX_LOT;

  const decisionTone =
    String(decision ?? "").toUpperCase() === "PASS"
      ? "green"
      : String(decision ?? "")
            .toUpperCase()
            .includes("BLOCK")
        ? "red"
        : "gray";

  return (
    <Panel
      title="KELLY DEMO ROUTER"
      right={`MAX LOT ${DEMO_MAX_LOT} · MAX RISK ${DEMO_MAX_RISK_PCT}%`}
    >
      {!k ? (
        <Waiting label="WAITING FOR KELLY DECISION" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <KV
              k="Kelly Suggested Lot"
              v={kellySuggested != null ? Number(kellySuggested).toFixed(4) : UNK}
            />
            <KV k="Raw Lot" v={rawLot != null ? Number(rawLot).toFixed(4) : UNK} />
            <KV
              k="Final Capped Lot"
              v={finalCappedDisplay.toFixed(4)}
              accent={overCap ? "loss" : "profit"}
            />
            <KV k="Max Lot Cap" v={DEMO_MAX_LOT.toFixed(2)} />
            <KV k="Risk %" v={riskPct != null ? `${riskPct}%` : UNK} />
            <KV k="Cap Reason" v={String(u(capReason))} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge value={`KELLY: ${u(decision)}`} tone={decisionTone as any} />
            {overCap && <Badge value="⚠ BACKEND FINAL CAP EXCEEDS DEMO MAX LOT" tone="red" />}
          </div>
          {blockReason && (
            <div className="mt-1 text-[10px] opacity-80">
              <b>BLOCK:</b> {String(blockReason)}
            </div>
          )}
          <div className="mt-2 border border-dashed border-black/60 p-1 text-[10px] uppercase tracking-widest text-center">
            ⚠ RAW KELLY LOT IS NOT EXECUTABLE. ONLY FINAL CAPPED LOT (≤ {DEMO_MAX_LOT}) IS
            EXECUTABLE.
          </div>
        </>
      )}
    </Panel>
  );
}

// ============ TIME ENGINE ============
// Extract time engine fields from backend payloads ONLY.
// Never uses browser Date(). Missing → UNKNOWN.
export function useBackendTime() {
  const ds = useDashboardStatusPayload();
  const { rows: decRows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: bsRows } = useLiveTable<any>("bot_status", {
    orderBy: "updated_at",
    ascending: false,
    limit: 5,
  });
  const dRP = getRP(decRows[0]);
  const bsRP = getRP(bsRows[0]);
  const dGate = (dRP.gate_statuses ?? {}) as Record<string, any>;
  const dsGate = ((ds as any).gate_statuses ?? {}) as Record<string, any>;
  const bsGate = (bsRP.gate_statuses ?? {}) as Record<string, any>;
  // dashboard_status ALWAYS wins, then gate_statuses, then bot_status row.
  const sources = [ds, dsGate, dRP, dGate, bsRP, bsGate, bsRows[0] ?? {}];
  const pickStr = (k: string) => {
    const v = getField(sources, k);
    return v == null || v === "" ? null : String(v);
  };
  const trim = (v: string | null) => {
    if (!v) return null;
    const m = v.match(/\d{2}:\d{2}(:\d{2})?/);
    return m ? m[0] : v;
  };
  return {
    utc: trim(pickStr("utc_time")),
    casa: trim(pickStr("casablanca_time")),
    broker: trim(pickStr("broker_time_estimate") ?? pickStr("broker_time")),
    session: pickStr("session") ?? pickStr("session_name") ?? pickStr("current_session"),
    gate_status: pickStr("time_gate_status") ?? pickStr("gate_time"),
    gate_reason: pickStr("time_gate_reason") ?? pickStr("gate_time_reason"),
    broker_utc_offset: pickStr("broker_utc_offset") ?? pickStr("broker_utc_offset_hours"),
    market_open: pickStr("market_open"),
    is_weekend: pickStr("is_weekend") ?? pickStr("safety_guard_is_weekend"),
    bad_hour: pickStr("bad_hour") ?? pickStr("is_bad_hour"),
  };
}

export function TimeEnginePanel() {
  const t = useBackendTime();
  return (
    <Panel title="TIME ENGINE" right="BACKEND · UTC · CASA · BROKER">
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="UTC" v={t.utc ?? UNK} />
        <KV k="Casablanca" v={t.casa ?? UNK} />
        <KV k="Broker Time Est." v={t.broker ?? UNK} />
        <KV k="Broker UTC Offset" v={t.broker_utc_offset ?? UNK} />
        <KV k="Session" v={t.session ?? UNK} />
        <KV k="Market Open" v={t.market_open ?? UNK} />
        <KV k="Weekend" v={t.is_weekend ?? UNK} />
        <KV k="Bad Hour" v={t.bad_hour ?? UNK} />
        <KV k="Time Gate Status" v={t.gate_status ?? UNK} />
      </div>
      <div className="mt-1 text-[10px] opacity-80">
        <b>TIME GATE REASON:</b> {t.gate_reason ?? UNK}
      </div>
      <div className="mt-1 text-[9px] opacity-60 uppercase tracking-widest">
        Times sourced from backend Time Engine. Browser clock not used.
      </div>
    </Panel>
  );
}

// ============ SMC / MTFA / MTF STRUCTURE ============
export function SmcMtfaPanel() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  const rp = getRP(d);
  return (
    <Panel
      title="SMC · MTFA · MTF STRUCTURE"
      right={d ? `${d.symbol ?? ""} ${d.timeframe ?? ""}` : "—"}
    >
      {!d ? (
        <Waiting />
      ) : (
        <div className="grid grid-cols-2 gap-x-3">
          <KV k="Direction" v={String(u(rp.direction ?? d.signal))} />
          <KV k="SMC Score" v={String(u(rp.smc_confluence_score ?? rp.smc_score))} />
          <KV k="SMC Status" v={String(u(rp.smc_confluence_status ?? rp.smc_status))} />
          <KV k="MTFA Status" v={String(u(rp.mtfa_status))} />
          <KV k="MTF Structure" v={String(u(rp.mtf_structure_status))} />
          <KV k="H4 Bias" v={String(u(rp.h4_bias ?? rp.smc_h4_direction))} />
          <KV k="H4 Zone" v={String(u(rp.h4_zone))} />
          <KV k="H1 Trend" v={String(u(rp.h1_trend))} />
          <KV
            k="M15 Confirmation"
            v={String(
              u(
                rp.m15_confirmation ??
                  rp.m15_entry_confirmation ??
                  (rp.gate_statuses ?? {}).m15_confirmation,
              ),
            )}
          />
          <KV
            k="M1 Confirmation"
            v={String(
              u(
                rp.m1_confirmation ??
                  rp.m1_entry_confirmation ??
                  rp.m1_trigger_status ??
                  (rp.gate_statuses ?? {}).m1_entry_confirmation ??
                  (rp.gate_statuses ?? {}).m1_confirmation,
              ),
            )}
          />
        </div>
      )}
      {d && (
        <div className="mt-1 text-[10px] opacity-80 space-y-0.5">
          <div>
            <b>SMC REASON:</b> {String(u(rp.smc_confluence_reason ?? rp.smc_reason))}
          </div>
          <div>
            <b>MTFA REASON:</b> {String(u(rp.mtfa_reason))}
          </div>
          <div>
            <b>MTF REASON:</b> {String(u(rp.mtf_structure_reason))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ============ TRADE JOURNAL TABS ============
type Tab = "OPEN_DEMO" | "HIST_DEMO" | "PAPER" | "HIST_PAPER";

export function TradeJournalTabs() {
  const [tab, setTab] = React.useState<Tab>("OPEN_DEMO");
  const ds = useDashboardStatusPayload();
  const heartbeat = String(ds.updated_at ?? ds.utc_time ?? ds.last_heartbeat ?? "");
  const { rows: demoRows } = useDemoTrades(heartbeat);
  const { rows: paperRows } = useLiveTable<any>("trades", { limit: 200 });

  const openDemo = React.useMemo(() => demoRows.filter(isOpenDemo), [demoRows]);
  const histDemo = React.useMemo(() => demoRows.filter(isHistDemo), [demoRows]);

  const paperOpen = React.useMemo(
    () =>
      paperRows.filter((t) => {
        const rp = getRP(t);
        const magic = t.magic_number ?? t.magic ?? rp.magic_number ?? rp.magic;
        const mode = String(rp.mode ?? t.signal ?? "").toUpperCase();
        const isPaper = Number(magic) === 909001 || mode === "PAPER";
        return isPaper && !isClosedTrade(t);
      }),
    [paperRows],
  );
  const paperHist = React.useMemo(
    () =>
      paperRows.filter((t) => {
        const rp = getRP(t);
        const magic = t.magic_number ?? t.magic ?? rp.magic_number ?? rp.magic;
        const mode = String(rp.mode ?? t.signal ?? "").toUpperCase();
        const isPaper = Number(magic) === 909001 || mode === "PAPER";
        return isPaper && isClosedTrade(t);
      }),
    [paperRows],
  );

  const dataset =
    tab === "OPEN_DEMO"
      ? openDemo
      : tab === "HIST_DEMO"
        ? histDemo
        : tab === "PAPER"
          ? paperOpen
          : paperHist;
  const sorted = [...dataset]
    .sort((a, b) => {
      const ta = new Date(a.opened_at ?? a.created_at).getTime();
      const tb = new Date(b.opened_at ?? b.created_at).getTime();
      return tb - ta;
    })
    .slice(0, 50);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "OPEN_DEMO", label: "OPEN DEMO (909002)", count: openDemo.length },
    { id: "HIST_DEMO", label: "HISTORICAL DEMO", count: histDemo.length },
    { id: "PAPER", label: "PAPER OPEN (909001)", count: paperOpen.length },
    { id: "HIST_PAPER", label: "HISTORICAL PAPER", count: paperHist.length },
  ];

  const emptyLabel = tab === "OPEN_DEMO" ? "No open HERMES demo trades" : `NO ${tab} TRADES`;

  return (
    <Panel title="TRADE JOURNALS" right={`${sorted.length} ROWS · REALTIME + 30s FALLBACK`}>
      <div className="flex border-b border-black mb-2 flex-wrap">
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
      {sorted.length === 0 ? (
        <Waiting label={emptyLabel} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black text-left uppercase tracking-wider">
                {[
                  "Time",
                  "Ticket",
                  "Magic",
                  "Sym",
                  "Dir",
                  "Entry",
                  "SL",
                  "TP",
                  "Lot",
                  "PnL",
                  "Strategy",
                  "RR",
                  "Kelly Sug.",
                  "Final Cap",
                  "Quant Score",
                  "R²",
                  "Z",
                  "QPro Score",
                  "Regime",
                  "OLS t",
                  "KZ",
                  "Hurst",
                  "Gate",
                  "Status",
                  "Close Reason",
                  "QX Status",
                  "Profit USD",
                  "Peak USD",
                  "BE Done",
                  "Trail Active",
                  "Last QX Action",
                ].map((h) => (
                  <th key={h} className="py-1 pr-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const rp = getRP(t);
                const ks = rp.kelly_suggested_lot ?? rp.raw_lot;
                const fc = rp.final_capped_lot ?? rp.demo_capped_lot ?? t.lot ?? t.lot_size;
                const fcNum = Number(fc ?? 0);
                const isDemoTab = tab === "OPEN_DEMO" || tab === "HIST_DEMO";
                const overCap = isDemoTab && fcNum > DEMO_MAX_LOT;
                const gate =
                  rp.gate_statuses?.safety_guard_status ??
                  rp.demo_gate_decision ??
                  rp.gate_status ??
                  t.reason ??
                  UNK;
                const closed = isClosedTrade(t);
                const status = closed
                  ? "CLOSED"
                  : String(t.result ?? rp.status ?? "OPEN").toUpperCase();
                const rawSym = rp.display_symbol ?? t.symbol;
                const brokerSym = (t as any).broker_symbol ?? rp.broker_symbol ?? null;
                const sym = normalizeSymbol(rawSym, brokerSym);
                const rr = rp.rr ?? rp.reward_risk ?? "-";
                const closeReason =
                  status === "CLOSED" ? (t.reason ?? rp.close_reason ?? "-") : "-";
                return (
                  <tr key={t.id} className="border-b border-dashed border-black/40">
                    <td className="py-1 pr-2 pixel">
                      {new Date(t.opened_at ?? t.created_at).toISOString().slice(11, 19)}
                    </td>
                    <td className="pr-2">{t.ticket ?? "—"}</td>
                    <td className="pr-2">{t.magic_number ?? t.magic ?? "—"}</td>
                    <td className="pr-2">{sym}</td>
                    <td className="pr-2">{t.dir}</td>
                    <td className="pr-2 pixel">{t.entry ?? "—"}</td>
                    <td className="pr-2 pixel text-loss">{t.sl ?? "—"}</td>
                    <td className="pr-2 pixel text-profit">{t.tp ?? "—"}</td>
                    <td className="pr-2">{t.lot ?? t.lot_size ?? "—"}</td>
                    <td className={`pr-2 pixel ${(t.pnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                      {(t.pnl ?? 0) >= 0 ? "+" : ""}
                      {t.pnl ?? 0}
                    </td>
                    <td className="pr-2">{t.strategy ?? "—"}</td>
                    <td className="pr-2">{rr}</td>
                    <td className="pr-2">{ks != null ? Number(ks).toFixed(4) : "-"}</td>
                    <td className={`pr-2 ${overCap ? "text-loss font-bold" : ""}`}>
                      {fc != null ? Number(fc).toFixed(4) : "-"}
                    </td>
                    <td className="pr-2">{rp.quant_score ?? "-"}</td>
                    <td className="pr-2">
                      {rp.quant_r2 != null ? Number(rp.quant_r2).toFixed(2) : "-"}
                    </td>
                    <td className="pr-2">
                      {rp.quant_z_score != null ? Number(rp.quant_z_score).toFixed(2) : "-"}
                    </td>
                    <td className="pr-2">{rp.quant_pro_score ?? "-"}</td>
                    <td className="pr-2">{rp.quant_pro_regime ?? "-"}</td>
                    <td className="pr-2">
                      {rp.quant_pro_ols_tstat != null
                        ? Number(rp.quant_pro_ols_tstat).toFixed(2)
                        : "-"}
                    </td>
                    <td className="pr-2">
                      {rp.quant_pro_kalman_z != null
                        ? Number(rp.quant_pro_kalman_z).toFixed(2)
                        : "-"}
                    </td>
                    <td className="pr-2">
                      {rp.quant_pro_hurst != null ? Number(rp.quant_pro_hurst).toFixed(2) : "-"}
                    </td>

                    <td className="pr-2">
                      <Badge value={String(gate)} tone={statusTone(String(gate))} />
                    </td>
                    <td className="pr-2">{status}</td>
                    <td className="pr-2 italic opacity-80">{closeReason}</td>
                    {(() => {
                      const qx = (rp.quick_exit ?? rp.quick_exit_state ?? {}) as any;
                      const qxStatus =
                        qx.status ?? rp.quick_exit_status ?? (closed ? "—" : "MONITORED");
                      const profitUsd =
                        qx.profit_usd ?? rp.profit_usd ?? rp.current_profit ?? t.pnl;
                      const peakUsd = qx.peak_usd ?? rp.peak_usd ?? rp.peak_profit;
                      const beDone = qx.be_done ?? rp.be_done ?? rp.breakeven_done;
                      const trailActive = qx.trail_active ?? rp.trail_active ?? rp.trailing_active;
                      const lastQx = qx.last_action ?? rp.last_quick_exit_action ?? "—";
                      const fmt = (v: any) =>
                        v == null || v === ""
                          ? "—"
                          : Number.isFinite(Number(v))
                            ? `${Number(v) >= 0 ? "+" : ""}$${Number(v).toFixed(2)}`
                            : String(v);
                      const boolLabel = (v: any) =>
                        v === true || String(v).toUpperCase() === "TRUE"
                          ? "✓"
                          : v === false || String(v).toUpperCase() === "FALSE"
                            ? "·"
                            : "—";
                      return (
                        <>
                          <td className="pr-2">{String(qxStatus)}</td>
                          <td
                            className={`pr-2 pixel ${Number(profitUsd ?? 0) >= 0 ? "text-profit" : "text-loss"}`}
                          >
                            {fmt(profitUsd)}
                          </td>
                          <td className="pr-2 pixel">{fmt(peakUsd)}</td>
                          <td className="pr-2 text-center">{boolLabel(beDone)}</td>
                          <td className="pr-2 text-center">{boolLabel(trailActive)}</td>
                          <td className="pr-2">{String(lastQx)}</td>
                        </>
                      );
                    })()}
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
  const ds = useDashboardStatusPayload();
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const s = snaps[0] ?? {};

  const demo = React.useMemo(
    () =>
      trades.filter((t) => {
        const rp = getRP(t);
        const magic = t.magic_number ?? t.magic ?? rp.magic_number;
        return Number(magic) === DEMO_MAGIC;
      }),
    [trades],
  );

  const {
    openedToday,
    closedToday,
    openNow,
    pnlTodayTrades,
    wins,
    losses,
    winRate,
    consec,
    sortedStrat,
  } = React.useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = (d: string | null | undefined) => d?.slice(0, 10) === todayStr;

    const openedToday = demo.filter((t) => isToday(t.opened_at ?? t.created_at)).length;
    const closedToday = demo.filter((t) => isToday(t.closed_at)).length;
    const openNow = demo.filter(isOpenDemo).length;
    const pnlTodayTrades = demo
      .filter((t) => isToday(t.closed_at))
      .reduce((acc: number, t) => acc + Number(t.pnl ?? 0), 0);
    const wins = demo.filter((t) => Number(t.pnl ?? 0) > 0).length;
    const losses = demo.filter((t) => Number(t.pnl ?? 0) < 0).length;
    const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : UNK;

    let consec = 0;
    const closedSorted = demo
      .filter((t) => t.closed_at)
      .sort(
        (a, b) => new Date(b.closed_at ?? "").getTime() - new Date(a.closed_at ?? "").getTime(),
      );
    for (const t of closedSorted) {
      if (Number(t.pnl ?? 0) < 0) consec++;
      else break;
    }

    const byStrat: Record<string, number> = {};
    for (const t of demo) {
      if (!t.strategy) continue;
      byStrat[t.strategy] = (byStrat[t.strategy] ?? 0) + Number(t.pnl ?? 0);
    }
    const sortedStrat = Object.entries(byStrat).sort((a, b) => b[1] - a[1]);

    return {
      openedToday,
      closedToday,
      openNow,
      pnlTodayTrades,
      wins,
      losses,
      winRate,
      consec,
      sortedStrat,
    };
  }, [demo]);

  const bestStrat = sortedStrat[0]?.[0] ?? UNK;
  const worstStrat = sortedStrat[sortedStrat.length - 1]?.[0] ?? UNK;

  const skipReasons = React.useMemo(() => {
    const res: Record<string, number> = {};
    for (const d of dec) {
      if (String(d.decision ?? "").toUpperCase() === "SKIP") {
        const r = d.blocked_reason ?? d.reason ?? "—";
        res[r] = (res[r] ?? 0) + 1;
      }
    }
    return res;
  }, [dec]);

  const lastKelly = React.useMemo(
    () =>
      getField([getRP(dec[0]), dec[0] ?? {}], "kelly_demo_decision") ??
      getField([getRP(dec[0]), dec[0] ?? {}], "kelly_decision") ??
      UNK,
    [dec],
  );

  const liveOrdersDetected = React.useMemo(
    () =>
      trades.some((t) => {
        const rp = getRP(t);
        return rp.mode && String(rp.mode).toUpperCase() === "LIVE";
      }),
    [trades],
  );

  const mt5TodayRaw =
    (ds as any).mt5_today_pnl ??
    (ds as any).mt5_daily_pnl ??
    (ds as any).today_pnl ??
    s.daily_pnl ??
    null;
  const mt5TodayPnl = mt5TodayRaw != null ? Number(mt5TodayRaw) : null;
  const usingMt5Truth = mt5TodayPnl != null && Number.isFinite(mt5TodayPnl);
  const pnlToday = usingMt5Truth ? (mt5TodayPnl as number) : pnlTodayTrades;
  const pnlSource = usingMt5Truth ? "MT5_HISTORY_DEALS" : "TRADES_TABLE";

  return (
    <Panel title="DEMO REPORT" right={`MAGIC 909002 · PNL ${pnlSource}`}>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-[9px] uppercase opacity-70">Opened Today</div>
          <div className="pixel text-[18px]">{openedToday}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">Closed Today</div>
          <div className="pixel text-[18px]">{closedToday}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">Open Now</div>
          <div className="pixel text-[18px]">{openNow}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">
            PnL Today ({usingMt5Truth ? "MT5" : "TRADES"})
          </div>
          <div className={`pixel text-[18px] ${pnlToday >= 0 ? "text-profit" : "text-loss"}`}>
            {pnlToday >= 0 ? "+" : ""}
            {pnlToday.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">Win Rate</div>
          <div className="pixel text-[18px]">
            {winRate}
            {winRate !== UNK && "%"}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">Consec. Losses</div>
          <div className={`pixel text-[18px] ${consec >= 3 ? "text-loss" : ""}`}>{consec}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">Best Strategy</div>
          <div className="text-[11px] font-bold">{bestStrat}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase opacity-70">Worst Strategy</div>
          <div className="text-[11px] font-bold">{worstStrat}</div>
        </div>
      </div>
      {usingMt5Truth && (
        <div className="mt-1 text-[10px] uppercase tracking-widest opacity-70">
          Trades-table PnL Today (secondary):{" "}
          <b>
            {pnlTodayTrades >= 0 ? "+" : ""}${pnlTodayTrades.toFixed(2)}
          </b>
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="font-bold uppercase opacity-70">Skipped Count by Reason</div>
          {Object.entries(skipReasons)
            .slice(0, 6)
            .map(([k, v]) => (
              <div key={k}>
                {v}× {k}
              </div>
            ))}
          {Object.keys(skipReasons).length === 0 && <div className="opacity-60">—</div>}
        </div>
        <div>
          <KV k="Last Kelly Decision" v={String(lastKelly)} />
          <KV
            k="Live Orders Detected"
            v={liveOrdersDetected ? "TRUE ⚠" : "false"}
            accent={liveOrdersDetected ? "loss" : "profit"}
          />
        </div>
      </div>
    </Panel>
  );
}

// ============ ALERTS ============
export function DemoAlerts() {
  const ds = useDashboardStatusPayload();
  const { rows: status } = useLiveTable<any>("bot_status", {
    orderBy: "updated_at",
    ascending: false,
    limit: 5,
  });
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 5 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 50 });

  const bsRP = getRP(status[0]);
  const decRP = getRP(dec[0]);
  const sources = [ds, bsRP, status[0] ?? {}, decRP, dec[0] ?? {}];

  const accountType = String(getField(sources, "account_type") ?? "").toUpperCase();
  const demoPilotEnabled = getField(sources, "demo_pilot_enabled");
  const allowLive = getField(sources, "allow_live_trading");

  const alerts: string[] = [];
  if (demoPilotEnabled && accountType && accountType !== "DEMO")
    alerts.push(`account_type=${accountType} while demo_pilot_enabled=true`);
  if (allowLive === true) alerts.push("allow_live_trading = true");

  // final lot > 0.01 on demo trades
  for (const t of trades) {
    const rp = getRP(t);
    const magic = t.magic_number ?? t.magic ?? rp.magic_number;
    if (Number(magic) === DEMO_MAGIC) {
      const lot = Number(t.lot ?? t.lot_size ?? 0);
      if (lot > DEMO_MAX_LOT) {
        alerts.push(`Demo trade ticket ${t.ticket ?? "?"} lot ${lot} > ${DEMO_MAX_LOT}`);
        break;
      }
    }
  }

  // demo order data with wrong magic
  for (const t of trades) {
    const rp = getRP(t);
    if (String(rp.mode ?? "").toUpperCase() === "DEMO") {
      const magic = t.magic_number ?? t.magic ?? rp.magic_number;
      if (Number(magic) !== DEMO_MAGIC) {
        alerts.push(`Demo order with magic ${magic} (expected ${DEMO_MAGIC})`);
        break;
      }
    }
  }

  if (decRP.smc_confluence_status && String(decRP.smc_confluence_status).toUpperCase() === "FAIL")
    alerts.push("SMC FAIL on latest signal");
  if (decRP.mtfa_status && String(decRP.mtfa_status).toUpperCase() === "FAIL")
    alerts.push("MTFA FAIL on latest signal");
  if (decRP.safety_guard_status && String(decRP.safety_guard_status).toUpperCase() !== "PASS")
    alerts.push(`Safety Guard = ${decRP.safety_guard_status}`);
  if (decRP.m1_confirmation === false) alerts.push("Missing M1 confirmation");
  if (decRP.order_send_attempted_outside_demo_router)
    alerts.push("order_send attempted outside demo router");

  // QUICK EXIT alerts — surface most recent QX action across trades + status
  const qxSources: any[] = [];
  const dsQx = (ds as any).quick_exit ?? (ds as any).quick_exit_manager;
  if (dsQx) qxSources.push(dsQx);
  const qxStatusRow = status.find((r: any) =>
    String(r.component ?? "")
      .toUpperCase()
      .includes("QUICK_EXIT"),
  );
  if (qxStatusRow) qxSources.push(getRP(qxStatusRow), qxStatusRow);
  for (const t of trades) {
    const rp = getRP(t);
    if (rp.quick_exit) qxSources.push(rp.quick_exit);
    if (rp.last_quick_exit_action)
      qxSources.push({
        last_action: rp.last_quick_exit_action,
        ticket: t.ticket,
        magic: t.magic_number ?? t.magic,
      });
  }
  const seen = new Set<string>();
  for (const q of qxSources) {
    const action = String(q?.last_action ?? q?.action ?? "").toUpperCase();
    if (!action || action === "HOLD" || action === "—") continue;
    const magic = Number(q?.magic ?? q?.magic_number ?? DEMO_MAGIC);
    const ticket = q?.ticket ?? q?.last_ticket ?? "?";
    let msg = "";
    if (action === "MOVE_BREAKEVEN" || action === "BREAKEVEN")
      msg = `QUICK EXIT MOVED TO BREAKEVEN · ticket ${ticket}`;
    else if (action === "TRAIL_SL" || action === "TRAIL")
      msg = `QUICK EXIT TRAILED SL · ticket ${ticket}`;
    else if (action === "CLOSE_TP") msg = `QUICK EXIT CLOSED AT SMALL TP · ticket ${ticket}`;
    else if (action === "SKIP" || action === "SKIPPED") {
      if (magic && magic !== DEMO_MAGIC)
        msg = `QUICK EXIT SKIPPED NON-HERMES MAGIC ${magic} · ticket ${ticket}`;
    }
    if (msg && !seen.has(msg)) {
      seen.add(msg);
      alerts.push(msg);
    }
  }

  return (
    <Panel title="ALERTS" right={`${alerts.length}`}>
      {alerts.length === 0 ? (
        <div className="text-[11px] text-profit uppercase tracking-widest text-center py-2">
          ✓ NO ACTIVE ALERTS
        </div>
      ) : (
        <ul className="space-y-1">
          {alerts.map((a, i) => (
            <li
              key={i}
              className="bg-red-600 text-white px-2 py-1 text-[11px] uppercase tracking-wider"
            >
              ⚠ {a}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ============ MISSING FIELDS ============
const REQUIRED_FIELDS: Array<{ name: string; source: string; lookup: (ctx: any) => any }> = [
  { name: "mode", source: "bot_status.dashboard_status", lookup: (c) => getField([c.ds], "mode") },
  {
    name: "account_type",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "account_type"),
  },
  {
    name: "demo_pilot_enabled",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "demo_pilot_enabled"),
  },
  {
    name: "demo_trading",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "demo_trading"),
  },
  {
    name: "demo_only",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "demo_only"),
  },
  {
    name: "allow_live_trading",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "allow_live_trading"),
  },
  {
    name: "live_trading_blocked",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "live_trading_blocked"),
  },
  {
    name: "magic_number",
    source: "bot_status.dashboard_status",
    lookup: (c) =>
      getField([c.ds, c.bsRP, c.bs], "demo_magic_number") ??
      getField([c.ds, c.bsRP, c.bs], "magic_number"),
  },
  {
    name: "mt5_connected",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.bsRP, c.bs], "mt5_connected"),
  },
  {
    name: "pilot_started_at",
    source: "bot_status.dashboard_status",
    lookup: (c) =>
      getField([c.ds, c.bsRP], "pilot_started_at") ??
      getField([c.ds, c.bsRP], "demo_pilot_started_at"),
  },
  {
    name: "pilot_expires_at",
    source: "bot_status.dashboard_status",
    lookup: (c) =>
      getField([c.ds, c.bsRP], "pilot_expires_at") ??
      getField([c.ds, c.bsRP], "demo_pilot_expires_at"),
  },
  {
    name: "utc_time",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.decRP, c.bsRP], "utc_time"),
  },
  {
    name: "casablanca_time",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.decRP, c.bsRP], "casablanca_time"),
  },
  {
    name: "broker_time_estimate",
    source: "bot_status.dashboard_status",
    lookup: (c) =>
      getField([c.ds, c.decRP, c.bsRP], "broker_time_estimate") ??
      getField([c.ds, c.decRP, c.bsRP], "broker_time"),
  },
  {
    name: "session",
    source: "bot_status.dashboard_status",
    lookup: (c) =>
      getField([c.ds, c.decRP, c.bsRP], "session") ??
      getField([c.ds, c.decRP, c.bsRP], "session_name"),
  },
  {
    name: "time_gate_status",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.decRP, c.bsRP], "time_gate_status"),
  },
  {
    name: "time_gate_reason",
    source: "bot_status.dashboard_status",
    lookup: (c) => getField([c.ds, c.decRP, c.bsRP], "time_gate_reason"),
  },
  {
    name: "last_demo_gate_decision",
    source: "ai_decisions / dashboard_status",
    lookup: (c) =>
      getField([c.ds, c.decRP, c.dec], "last_demo_gate_decision") ??
      getField([c.ds, c.decRP], "demo_gate_decision"),
  },
  {
    name: "kelly_suggested_lot",
    source: "kelly_risk.raw_payload",
    lookup: (c) => getField([c.kRP, c.k], "kelly_suggested_lot") ?? getField([c.kRP], "raw_lot"),
  },
  {
    name: "final_capped_lot",
    source: "kelly_risk.raw_payload",
    lookup: (c) => getField([c.kRP, c.k], "final_capped_lot") ?? c.k?.lot_size,
  },
  {
    name: "m1_confirmation",
    source:
      "ai_decisions.raw_payload (or m1_entry_confirmation / m1_trigger_status / gate_statuses.m1_entry_confirmation)",
    lookup: (c) => {
      const g = (c.decRP?.gate_statuses ?? {}) as Record<string, any>;
      return (
        getField([c.decRP], "m1_confirmation") ??
        getField([c.decRP], "m1_entry_confirmation") ??
        getField([c.decRP], "m1_trigger_status") ??
        getField([g], "m1_entry_confirmation") ??
        getField([g], "m1_confirmation")
      );
    },
  },
  {
    name: "m15_confirmation",
    source: "ai_decisions.raw_payload",
    lookup: (c) => {
      const g = (c.decRP?.gate_statuses ?? {}) as Record<string, any>;
      return (
        getField([c.decRP], "m15_confirmation") ??
        getField([c.decRP], "m15_entry_confirmation") ??
        getField([g], "m15_confirmation")
      );
    },
  },
  {
    name: "smc_confluence_status",
    source: "ai_decisions.raw_payload",
    lookup: (c) =>
      getField([c.decRP], "smc_confluence_status") ?? getField([c.decRP], "smc_status"),
  },
  {
    name: "mtfa_status",
    source: "ai_decisions.raw_payload",
    lookup: (c) => getField([c.decRP], "mtfa_status"),
  },
  {
    name: "safety_guard_status",
    source: "ai_decisions.raw_payload",
    lookup: (c) => getField([c.decRP], "safety_guard_status"),
  },
  {
    name: "top_down_market_reader",
    source: "ai_decisions.raw_payload.top_down",
    lookup: (c) => {
      const td = (c.decRP?.top_down ?? c.decRP?.raw_payload?.top_down ?? {}) as Record<string, any>;
      return (
        getField([td], "status") ??
        getField([td], "decision") ??
        getField([c.decRP], "top_down_status") ??
        getField([c.decRP], "top_down_decision")
      );
    },
  },
];

// Optional fields — backend may not emit these yet. They are surfaced as
// "missing optional" in the Hermes Audit Panel and do NOT block readiness.
const OPTIONAL_FIELDS: Array<{ name: string; source: string; lookup: (ctx: any) => any }> = [
  {
    name: "acceleration_bands_htf",
    source: "ai_decisions.raw_payload (optional)",
    lookup: (c) =>
      getField([c.decRP], "acceleration_bands_status") ??
      getField([c.decRP], "accel_bands_status") ??
      getField([c.decRP], "acceleration_bands_htf"),
  },
  {
    name: "volume_profile",
    source: "ai_decisions.raw_payload (optional)",
    lookup: (c) =>
      getField([c.decRP], "volume_profile") ??
      getField([c.decRP], "volume_profile_status") ??
      getField([c.decRP], "vol_profile"),
  },
];

export function MissingFieldsPanel() {
  const ds = useDashboardStatusPayload();
  const { rows: bsRows } = useLiveTable<any>("bot_status", {
    orderBy: "updated_at",
    ascending: false,
    limit: 1,
  });
  const { rows: decRows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: kRows } = useLiveTable<any>("kelly_risk", { limit: 1 });

  const ctx = React.useMemo(
    () => ({
      ds,
      bs: bsRows[0] ?? {},
      bsRP: getRP(bsRows[0]),
      dec: decRows[0] ?? {},
      decRP: getRP(decRows[0]),
      k: kRows[0] ?? {},
      kRP: getRP(kRows[0]),
    }),
    [ds, bsRows, decRows, kRows],
  );

  const isMissing = (v: unknown) => {
    if (v == null) return true;
    if (typeof v === "string") {
      const s = v.trim().toUpperCase();
      return (
        s === "" ||
        s === "UNKNOWN" ||
        s === "WAITING" ||
        s === "WAITING DATA" ||
        s === "—" ||
        s === "N/A"
      );
    }
    return false;
  };

  const missing = React.useMemo(
    () => REQUIRED_FIELDS.filter((f) => isMissing(f.lookup(ctx))),
    [ctx],
  );
  const optionalMissing = React.useMemo(
    () => OPTIONAL_FIELDS.filter((f) => isMissing(f.lookup(ctx))),
    [ctx],
  );

  // Warn only when more than 3 required fields are missing AND an ai_decisions row exists.
  React.useEffect(() => {
    if (missing.length > 3 && decRows[0] != null) {
      console.warn(
        `[HERMES] ${missing.length} required backend fields missing:`,
        missing.map((f) => f.name),
      );
    }
  }, [missing, decRows]);

  return (
    <Panel
      title="MISSING BACKEND FIELDS"
      right={`${missing.length} REQUIRED MISSING · ${optionalMissing.length} OPTIONAL`}
    >
      {missing.length === 0 ? (
        <div className="text-[11px] text-profit uppercase tracking-widest text-center py-2">
          ✓ ALL REQUIRED FIELDS PRESENT
        </div>
      ) : (
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-black text-left uppercase tracking-wider">
              <th className="py-1">Field</th>
              <th>Expected Source</th>
              <th>Current Value</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((f) => (
              <tr key={f.name} className="border-b border-dashed border-black/40">
                <td className="py-1 pr-2 font-bold">{f.name}</td>
                <td className="pr-2 opacity-80">{f.source}</td>
                <td className="pr-2">
                  <Badge value={UNK} tone="gray" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {optionalMissing.length > 0 && (
        <div className="mt-2 border-t border-dashed border-black/50 pt-2">
          <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">
            Missing optional fields (backend may not emit yet)
          </div>
          <table className="w-full text-[10px]">
            <tbody>
              {optionalMissing.map((f) => (
                <tr key={f.name} className="border-b border-dashed border-black/30">
                  <td className="py-0.5 pr-2 font-bold">{f.name}</td>
                  <td className="pr-2 opacity-70">{f.source}</td>
                  <td className="pr-2">
                    <Badge value="MISSING (OPTIONAL)" tone="orange" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
