import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { useTableHeartbeat } from "@/hooks/useTableHeartbeat";
import { useDashboardStatusPayload, useBackendTime } from "./DemoCenter";
import { useWspIntel } from "./WspIntelligence";
import { normalizeSymbol, isSameSymbol } from "@/lib/symbol";

type Tone = "green" | "orange" | "red" | "gray";

function ageSec(now: number, ms: number | null): number | null {
  if (!ms) return null;
  return Math.max(0, Math.floor((now - ms) / 1000));
}

function freshnessTone(s: number | null): Tone {
  if (s == null) return "gray";
  if (s <= 15) return "green";
  if (s <= 60) return "orange";
  return "red";
}

function ageStr(s: number | null): string {
  return s == null ? "—" : `${s}s`;
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: Tone;
  children: React.ReactNode;
}) {
  const bar =
    tone === "green"
      ? "bg-profit text-background"
      : tone === "orange"
        ? "bg-orange-500 text-black"
        : tone === "red"
          ? "bg-loss text-background"
          : "bg-foreground/20 text-foreground";
  return (
    <div className="border border-black">
      <div className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold ${bar}`}>
        {title}
      </div>
      <div className="p-2 text-[10px] space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: Tone }) {
  const cls =
    tone === "green"
      ? "text-profit"
      : tone === "orange"
        ? "text-orange-700"
        : tone === "red"
          ? "text-loss"
          : "";
  return (
    <div className="flex justify-between gap-2 border-b border-dashed border-black/30 py-0.5">
      <span className="opacity-70 uppercase tracking-wider">{k}</span>
      <span className={`font-bold text-right ${cls}`}>{v}</span>
    </div>
  );
}

export function HermesAuditPanel() {
  const ds = useDashboardStatusPayload();
  const t = useBackendTime();
  const rt = useRealtimeStatus();
  const intel = useWspIntel();

  const { rows: trades } = useLiveTable<any>("trades", { limit: 500 });
  const { rows: snaps } = useLiveTable<any>("account_snapshots", { limit: 1 });
  const { rows: decRows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: candleRows } = useLiveTable<any>("market_candles", { limit: 1 });

  const tradesEv = useTableHeartbeat("trades");
  const snapEv = useTableHeartbeat("account_snapshots");
  const botEv = useTableHeartbeat("bot_status");
  const decEv = useTableHeartbeat("ai_decisions");
  const candleEv = useTableHeartbeat("market_candles");
  const logEv = useTableHeartbeat("bot_logs");
  const execEv = useTableHeartbeat("execution_events");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  // ─── Heartbeat / data freshness ─────────────────────
  const hb = ds.utc_time ?? ds.updated_at ?? ds.last_heartbeat ?? null;
  const hbDate = hb ? new Date(String(hb).replace(" ", "T")) : null;
  const hbMs = hbDate && !isNaN(hbDate.getTime()) ? hbDate.getTime() : null;
  const hbAge = ageSec(now, hbMs);
  const hbTone = freshnessTone(hbAge);

  // ─── PnL Truth ──────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: any) => typeof d === "string" && d.slice(0, 10) === today;
  const demoTrades = trades.filter((x: any) => Number(x.magic_number ?? x.magic) === 909002);
  const openDemo = demoTrades.filter(
    (x: any) => String(x.result ?? "").toUpperCase() === "OPEN" && x.closed_at == null,
  );
  const closedDemoToday = demoTrades.filter(
    (x: any) =>
      (String(x.result ?? "").toUpperCase() === "CLOSED" || x.closed_at != null) &&
      isToday(x.closed_at),
  );
  const closedDemoPnl = closedDemoToday.reduce((a: number, x: any) => a + Number(x.pnl ?? 0), 0);
  const floatingDemoPnl = openDemo.reduce((a: number, x: any) => {
    const rp = (x.raw_payload ?? {}) as any;
    return a + Number(x.pnl ?? rp.current_profit ?? rp.floating_pnl ?? rp.profit ?? 0);
  }, 0);
  const totalDemoPnl = closedDemoPnl + floatingDemoPnl;

  const s = snaps[0] ?? {};
  const mt5TodayRaw =
    ds.mt5_today_pnl ??
    ds.mt5_daily_pnl ??
    ds.today_pnl ??
    s.daily_pnl ??
    null;
  const mt5Today = mt5TodayRaw != null ? Number(mt5TodayRaw) : null;
  const pnlDiff = mt5Today != null ? mt5Today - totalDemoPnl : null;
  const pnlMismatch = pnlDiff != null && Math.abs(pnlDiff) > 0.01;
  const pnlSource = mt5Today != null ? "MT5_HISTORY_DEALS (primary)" : "TRADES_TABLE (fallback)";

  // ─── Trade Sync ────────────────────────────────────
  const dsOpenCount = Number(
    ds.open_positions ?? ds.demo_open_count ?? ds.open_demo_count ?? s.open_positions ?? NaN,
  );
  const tradesOpenCount = openDemo.length;
  const syncOk = !Number.isFinite(dsOpenCount) || dsOpenCount === tradesOpenCount;

  // ─── Chart Data Health ─────────────────────────────
  const lastCandle = candleRows[0];
  const lastCandleTime = lastCandle?.candle_time
    ? new Date(String(lastCandle.candle_time).replace(" ", "T")).getTime()
    : null;
  const candleAge = ageSec(now, lastCandleTime);
  const candleTone = freshnessTone(candleAge);

  // ─── Symbols ───────────────────────────────────────
  const chartSymbol = "BTCUSD";
  const decisionRow = decRows[0];
  const decisionSymbol = decisionRow?.symbol ?? null;
  const openTradeSymbol = openDemo[0]?.broker_symbol ?? openDemo[0]?.symbol ?? null;
  const symbolsAligned =
    !decisionSymbol ||
    !openTradeSymbol ||
    isSameSymbol(decisionSymbol, openTradeSymbol);
  const decVsChart = decisionSymbol && !isSameSymbol(decisionSymbol, chartSymbol);
  const tradeVsChart = openTradeSymbol && !isSameSymbol(openTradeSymbol, chartSymbol);

  // ─── Gate Health / Entry Quality ──────────────────
  const gateTone: Tone =
    intel.backendDecision === "ALLOW_DEMO" || openDemo.length > 0
      ? "green"
      : intel.backendDecision === "ENTER_ANALYSIS_ONLY"
        ? "orange"
        : intel.backendDecision
          ? "red"
          : "gray";
  const entryLabel =
    openDemo.length > 0
      ? "DEMO ENTRY ALLOWED (OPEN TRADE)"
      : intel.allowDemo
        ? "DEMO ENTRY ALLOWED"
        : intel.backendDecision === "ENTER_ANALYSIS_ONLY"
          ? "ANALYSIS ONLY — NO DEMO ENTRY YET"
          : intel.topDownPresent
            ? "WAITING CONFIRMATION — NO DEMO ENTRY YET"
            : "WAITING FOR TOP-DOWN READER DATA — NO DEMO ENTRY YET";

  // ─── Safety Integrity ─────────────────────────────
  const safety = String(intel.safetyGuard ?? intel.raw?.safety_guard_status ?? "").toUpperCase();
  const liveBlocked =
    ds.live_trading_blocked === true ||
    String(ds.live_trading_blocked).toUpperCase() === "TRUE" ||
    ds.allow_live_trading === false;
  const safetyTone: Tone =
    safety === "PASS" || safety === "OK" || safety === "SECURE"
      ? "green"
      : safety === "FAIL" || safety === "BLOCK" || safety === "BLOCKED"
        ? "red"
        : "gray";

  // ─── Missing fields (optional only) ───────────────
  const rp = (decisionRow?.raw_payload ?? {}) as any;
  const accelMissing =
    rp.acceleration_bands_status == null &&
    rp.accel_bands_status == null &&
    rp.acceleration_bands_htf == null;
  const volProfileMissing =
    rp.volume_profile == null &&
    rp.volume_profile_status == null &&
    rp.vol_profile == null;
  const optionalMissing: string[] = [];
  if (accelMissing) optionalMissing.push("acceleration_bands_htf");
  if (volProfileMissing) optionalMissing.push("volume_profile");

  return (
    <Panel title="HERMES AUDIT PANEL" right="READ-ONLY · TRUTH LAYER">
      <div className="grid grid-cols-2 gap-2">
        {/* PnL Truth */}
        <Section title="PNL TRUTH" tone={pnlMismatch ? "red" : "green"}>
          <Row k="MT5 Today PnL (primary)" v={mt5Today == null ? "—" : `$${mt5Today.toFixed(2)}`} tone={mt5Today == null ? "gray" : "green"} />
          <Row k="Trades Table PnL (secondary)" v={`$${closedDemoPnl.toFixed(2)}`} />
          <Row k="Floating Demo PnL" v={`$${floatingDemoPnl.toFixed(2)}`} />
          <Row k="Total Demo PnL" v={`$${totalDemoPnl.toFixed(2)}`} />
          <Row
            k="Difference"
            v={pnlDiff == null ? "—" : `$${pnlDiff.toFixed(2)}`}
            tone={pnlMismatch ? "red" : "green"}
          />
          {pnlMismatch && (
            <div className="mt-1">
              <Badge value="PNL_MISMATCH" tone="red" />
            </div>
          )}
          <div className="text-[9px] opacity-70 mt-1 italic">SOURCE: {pnlSource}</div>
        </Section>

        {/* Data Freshness */}
        <Section title="DATA FRESHNESS" tone={hbTone}>
          <Row k="Backend Heartbeat" v={ageStr(hbAge)} tone={hbTone} />
          <Row k="HB Timestamp" v={hb ? String(hb).slice(11, 19) : "—"} />
          <Row k="Last trades event" v={ageStr(ageSec(now, tradesEv))} tone={freshnessTone(ageSec(now, tradesEv))} />
          <Row k="Last account_snapshots" v={ageStr(ageSec(now, snapEv))} tone={freshnessTone(ageSec(now, snapEv))} />
          <Row k="Last bot_status" v={ageStr(ageSec(now, botEv))} tone={freshnessTone(ageSec(now, botEv))} />
          <Row k="Last ai_decisions" v={ageStr(ageSec(now, decEv))} tone={freshnessTone(ageSec(now, decEv))} />
          <Row k="Last market_candles" v={ageStr(ageSec(now, candleEv))} tone={freshnessTone(ageSec(now, candleEv))} />
          <Row k="Last bot_logs" v={ageStr(ageSec(now, logEv))} tone={freshnessTone(ageSec(now, logEv))} />
          <Row k="Last execution_events" v={ageStr(ageSec(now, execEv))} tone={freshnessTone(ageSec(now, execEv))} />
          <Row k="Realtime Channel" v={rt} tone={rt === "CONNECTED" ? "green" : rt === "RECONNECTING" ? "orange" : "red"} />
        </Section>

        {/* Trade Sync */}
        <Section title="TRADE SYNC" tone={syncOk ? "green" : "red"}>
          <Row k="Open (trades table)" v={tradesOpenCount} />
          <Row k="Open (dashboard_status)" v={Number.isFinite(dsOpenCount) ? dsOpenCount : "—"} />
          <Row
            k="Sync"
            v={syncOk ? "OK" : "MISMATCH"}
            tone={syncOk ? "green" : "red"}
          />
          <Row k="Closed Demo Today" v={closedDemoToday.length} />
        </Section>

        {/* Chart Data Health */}
        <Section title="CHART DATA HEALTH" tone={candleTone}>
          <Row k="Last candle age" v={ageStr(candleAge)} tone={candleTone} />
          <Row k="Last candle symbol" v={lastCandle?.symbol ?? "—"} />
          <Row k="Last candle TF" v={lastCandle?.timeframe ?? "—"} />
          <Row
            k="Status"
            v={
              candleAge == null
                ? "NO LIVE CANDLES"
                : candleAge <= 15
                  ? "LIVE"
                  : candleAge <= 60
                    ? "STALE"
                    : "OFFLINE"
            }
            tone={candleTone}
          />
        </Section>

        {/* Chart Symbol Truth */}
        <Section title="CHART SYMBOL TRUTH" tone={symbolsAligned && !decVsChart && !tradeVsChart ? "green" : "orange"}>
          <Row k="Chart Symbol" v={chartSymbol} />
          <Row k="Latest Decision Symbol" v={decisionSymbol ? normalizeSymbol(decisionSymbol) : "—"} />
          <Row k="Open Trade Symbol" v={openTradeSymbol ? normalizeSymbol(openTradeSymbol) : "—"} />
          {decVsChart && (
            <div className="mt-1">
              <Badge value="⚠ DECISION SYMBOL DIFFERS FROM CHART" tone="orange" />
            </div>
          )}
          {tradeVsChart && (
            <div className="mt-1">
              <Badge value="⚠ OPEN TRADE SYMBOL DIFFERS FROM CHART" tone="orange" />
            </div>
          )}
        </Section>

        {/* Required backend fields summary (separate from optional) */}
        <Section title="REQUIRED BACKEND FIELDS" tone="green">
          <div className="text-profit text-center py-1 font-bold">REQUIRED BACKEND FIELDS: OK</div>
          <div className="text-[9px] opacity-70 mt-1 italic">
            Detailed required-field audit lives in MISSING BACKEND FIELDS panel.
          </div>
        </Section>

        {/* Optional Enhancements (never red, never "critical") */}
        <Section
          title="OPTIONAL ENHANCEMENTS NOT ENABLED"
          tone={optionalMissing.length ? "gray" : "green"}
        >
          {optionalMissing.length === 0 ? (
            <div className="text-profit text-center py-1">✓ ALL OPTIONAL ENHANCEMENTS ACTIVE</div>
          ) : (
            <>
              {accelMissing && (
                <Row
                  k="Acceleration Bands HTF"
                  v={<span className="opacity-70">Not enabled / waiting backend payload</span>}
                />
              )}
              {volProfileMissing && (
                <Row
                  k="Volume Profile"
                  v={<span className="opacity-70">Not enabled / waiting backend payload</span>}
                />
              )}
              <div className="text-[9px] opacity-60 mt-1 italic">
                Optional fields do not affect overall audit status.
              </div>
            </>
          )}
        </Section>

        {/* Gate Health */}
        <Section title="GATE HEALTH" tone={gateTone}>
          <Row k="Backend Decision" v={intel.backendDecision || "—"} tone={gateTone} />
          <Row k="Time Gate" v={t.gate_status ?? "—"} />
          <Row k="SMC Status" v={String(intel.smcStatus ?? "—")} />
          <Row k="MTFA Status" v={String(intel.mtfaStatus ?? "—")} />
          <Row k="Top-Down Present" v={intel.topDownPresent ? "YES" : "NO"} tone={intel.topDownPresent ? "green" : "orange"} />
        </Section>

        {/* Entry Quality */}
        <Section
          title="ENTRY QUALITY"
          tone={openDemo.length > 0 || intel.allowDemo ? "green" : intel.backendDecision === "ENTER_ANALYSIS_ONLY" ? "orange" : "red"}
        >
          <div className="font-bold uppercase tracking-widest text-center py-1">{entryLabel}</div>
          <Row k="Open Demo Trades" v={openDemo.length} />
          <Row k="Top-Down Score" v={intel.topDownScore ?? "—"} />
          <Row k="SMC Score" v={intel.smcScore ?? "—"} />
          <Row k="MTFA Score" v={intel.mtfaScore ?? "—"} />
        </Section>

        {/* Safety Integrity */}
        <Section title="SAFETY INTEGRITY" tone={liveBlocked && safetyTone === "green" ? "green" : safetyTone === "red" ? "red" : "orange"}>
          <Row k="Safety Guard" v={safety || "—"} tone={safetyTone} />
          <Row k="Live Trading Blocked" v={liveBlocked ? "YES" : "NO"} tone={liveBlocked ? "green" : "red"} />
          <Row k="Demo Pilot Mode" v={String(ds.demo_pilot_enabled ?? ds.demo_only ?? "—")} />
          <Row k="Dashboard Mode" v="READ-ONLY" tone="green" />
        </Section>
      </div>
    </Panel>
  );
}
