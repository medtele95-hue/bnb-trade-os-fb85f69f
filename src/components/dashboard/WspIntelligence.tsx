import { useMemo, useState } from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { CandleChart } from "./CandleChart";
import { ConfirmationRibbon, useQuantData, useQuantProData } from "./QuantStrategy";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDashboardStatusPayload } from "./DemoCenter";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type Tone = "green" | "orange" | "red" | "gray";

function pickFrom(obj: any, ...keys: string[]) {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function fmtN(v: any, digits = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(digits);
}

function toneOfStatus(s: any): Tone {
  const v = String(s ?? "").toUpperCase();
  if (["PASS", "OK", "BUY", "BULLISH", "ALIGNED", "ALLOW_DEMO", "SECURE", "VALID", "CONFIRM", "CONFIRM_BUY", "CONFIRM_SELL", "ACCUMULATION", "RISING SAFE", "FALLING SAFE", "INST. LOGIN"].includes(v)) return "green";
  if (["FAIL", "SELL", "BEARISH", "CONFLICT", "AVOID", "DANGER", "TRAP", "BULL TRAP", "BEAR TRAP", "DISTRIBUTION", "RISING RISK", "INST. EXIT"].includes(v)) return "red";
  if (["WAIT", "WAIT_FOR_CONFIRMATION", "CAUTION", "EXHAUST", "HUNTING", "RETAIL FLOW", "NO_EDGE", "FLAT"].includes(v)) return "orange";
  return "gray";
}

// ─────────────────────────────────────────────────────────────
// Aggregated intelligence hook
// ─────────────────────────────────────────────────────────────

export function useWspIntel() {
  const ds = useDashboardStatusPayload();
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 50 });
  const d = dec[0] ?? {};
  const rp = (d.raw_payload ?? {}) as any;
  const inner = (rp.raw_payload ?? {}) as any;
  const gs = (rp.gate_statuses ?? inner.gate_statuses ?? {}) as any;
  const top = (rp.top_down ?? inner.top_down ?? {}) as any;
  const smc = (rp.smc ?? inner.smc ?? {}) as any;
  const mtfa = (rp.mtfa ?? inner.mtfa ?? {}) as any;
  const wsp = (rp.wsp ?? inner.wsp ?? rp.wsp_intel ?? {}) as any;

  const m = { ...ds, ...inner, ...rp, ...gs, ...top, ...smc, ...mtfa, ...wsp } as any;

  const openDemo = trades.find(
    (t: any) =>
      Number(t.magic_number ?? t.magic) === 909002 &&
      String(t.result ?? "").toUpperCase() === "OPEN" &&
      t.closed_at == null,
  );

  const backendDecision = String(pickFrom(m, "decision") ?? d.decision ?? "").toUpperCase();

  // Strict gate: only show DEMO ENTRY ALLOWED if there's a real open demo trade
  // OR backend decision is exactly ALLOW_DEMO AND top-down/SMC/MTFA are not failing.
  const _smc = String(pickFrom(m, "smc_confluence_status", "smc_status") ?? "").toUpperCase();
  const _mtfa = String(pickFrom(m, "mtfa_status") ?? "").toUpperCase();
  const _topDownPresent =
    pickFrom(m, "top_down_status") != null ||
    pickFrom(m, "top_down_decision") != null ||
    pickFrom(m, "entry_readiness_score", "top_down_score") != null;
  const _allowDemo =
    !!openDemo ||
    (backendDecision === "ALLOW_DEMO" &&
      _topDownPresent &&
      _smc !== "FAIL" &&
      _mtfa !== "FAIL");

  return {
    raw: m,
    decision: d,
    rp,
    top,
    smc,
    mtfa,
    wsp,
    gates: gs,
    openDemo,
    backendDecision,
    allowDemo: _allowDemo,
    topDownPresent: _topDownPresent,
    // top-level resolved fields
    h4: pickFrom(m, "h4_bias", "htf_bias", "h4_state"),
    h1: pickFrom(m, "h1_bias", "h1_state"),
    m15: pickFrom(m, "m15_status", "m15"),
    m1: pickFrom(m, "m1_entry_confirmation", "m1_trigger_status", "m1"),
    smcStatus: pickFrom(m, "smc_confluence_status", "smc_status"),
    smcScore: pickFrom(m, "smc_score", "smc_confluence_score"),
    mtfaStatus: pickFrom(m, "mtfa_status"),
    mtfaScore: pickFrom(m, "mtfa_score"),
    topDownStatus: pickFrom(m, "top_down_status"),
    topDownDecision: pickFrom(m, "top_down_decision"),
    topDownScore: pickFrom(m, "entry_readiness_score", "top_down_score"),
    narrative: pickFrom(m, "market_narrative"),
    missingConfirmations: pickFrom(m, "missing_confirmations"),
    bos: pickFrom(m, "bos_choch", "bos_status"),
    obFvg: pickFrom(m, "ob_fvg", "ob_fvg_status"),
    liquiditySweep: pickFrom(m, "liquidity_sweep"),
    // intelligence
    marketState: pickFrom(m, "market_state", "wsp_market_state"),
    htfTrend: pickFrom(m, "htf_trend", "wsp_htf_trend"),
    mmSentiment: pickFrom(m, "mm_sentiment", "smart_money_sentiment"),
    volPressure: pickFrom(m, "vol_pressure", "volume_pressure"),
    riskScore: pickFrom(m, "wsp_risk_score", "risk_score"),
    whaleAct: pickFrom(m, "whale_activity", "whale_act"),
    safetyGuard: pickFrom(m, "safety_guard_status", "safety_guard"),
    trapCheck: pickFrom(m, "trap_check", "wsp_trap"),
    zScore: pickFrom(m, "wsp_z_score", "z_score"),
    stableDom: pickFrom(m, "stable_dominance", "stable_dom"),
    smAction: pickFrom(m, "sm_action", "smart_money_action"),
    // zones
    entry: pickFrom(m, "entry"),
    sl: pickFrom(m, "sl"),
    tp1: pickFrom(m, "tp1", "tp"),
    tp2: pickFrom(m, "tp2"),
    tp3: pickFrom(m, "tp3"),
    h4Demand: pickFrom(m, "h4_demand_zone", "h4_demand"),
    h4Supply: pickFrom(m, "h4_supply_zone", "h4_supply"),
    fvg1h: pickFrom(m, "h1_fvg", "fvg_1h"),
    ote: pickFrom(m, "ote_zone", "ote"),
    smEnter: pickFrom(m, "sm_enter_zone", "smart_money_enter"),
    smExit: pickFrom(m, "sm_exit_zone", "smart_money_exit"),
    accelUpper: pickFrom(m, "accel_band_upper", "accel_upper"),
    accelMiddle: pickFrom(m, "accel_band_middle", "accel_middle"),
    accelLower: pickFrom(m, "accel_band_lower", "accel_lower"),
    accelStatus: pickFrom(m, "acceleration_bands_status", "accel_bands_status"),
    rr: pickFrom(m, "rr", "reward_risk"),
    spread: pickFrom(m, "spread"),
    lot: pickFrom(m, "final_capped_lot", "demo_capped_lot", "lot_size"),
  };
}

// ─────────────────────────────────────────────────────────────
// Chart overlay labels
// ─────────────────────────────────────────────────────────────

type ToggleState = {
  wspLabels: boolean;
  topDownLabels: boolean;
  quantLabels: boolean;
  smartMoneyZones: boolean;
  accelBands: boolean;
  entryPlan: boolean;
  missing: boolean;
};

function WspOverlayLabels({ intel, toggles }: { intel: ReturnType<typeof useWspIntel>; toggles: ToggleState }) {
  const q = useQuantData();
  const qp = useQuantProData();

  const labels: { text: string; tone: Tone }[] = [];

  if (toggles.wspLabels) {
    const wspSignal = String(intel.raw.wsp_signal ?? "").toUpperCase();
    if (wspSignal === "STRONG_BUY") labels.push({ text: "STRONG BUY", tone: "green" });
    else if (wspSignal === "STRONG_SELL") labels.push({ text: "STRONG SELL", tone: "red" });
    else if (wspSignal === "WEAK_BUY") labels.push({ text: "Weak Buy", tone: "orange" });
    else if (wspSignal === "WEAK_SELL") labels.push({ text: "Weak Sell", tone: "orange" });

    const sm = String(intel.raw.sm_signal ?? intel.smAction ?? "").toUpperCase();
    if (sm.includes("ENTER") || sm === "INST. LOGIN") labels.push({ text: "SM ENTER", tone: "green" });
    if (sm.includes("EXIT") || sm === "INST. EXIT") labels.push({ text: "SM EXIT", tone: "red" });

    const flag = String(intel.raw.wsp_flag ?? "").toUpperCase();
    if (flag === "ROCKET") labels.push({ text: "🚀 ROCKET", tone: "green" });
    if (flag === "CRASH") labels.push({ text: "💥 CRASH", tone: "red" });
    if (flag === "EXHAUST") labels.push({ text: "EXHAUST", tone: "orange" });
    if (flag === "LOW_VOL") labels.push({ text: "LOW VOL", tone: "gray" });

    const trap = String(intel.trapCheck ?? "").toUpperCase();
    if (trap === "BULL_TRAP" || trap === "BULL TRAP") labels.push({ text: "BULL TRAP", tone: "red" });
    if (trap === "BEAR_TRAP" || trap === "BEAR TRAP") labels.push({ text: "BEAR TRAP", tone: "red" });

    const rev = String(intel.raw.reversal_signal ?? "").toUpperCase();
    if (rev === "LONG") labels.push({ text: "POSSIBLE REVERSAL LONG", tone: "green" });
    if (rev === "SHORT") labels.push({ text: "POSSIBLE REVERSAL SHORT", tone: "red" });
  }

  if (toggles.topDownLabels) {
    const h4 = String(intel.h4 ?? "").toUpperCase();
    if (h4) labels.push({ text: `H4 ${h4}`, tone: toneOfStatus(h4) });
    const h1 = String(intel.h1 ?? "").toUpperCase();
    if (h1) labels.push({ text: `H1 ${h1}`, tone: toneOfStatus(h1) });
    const m15 = String(intel.m15 ?? "").toUpperCase();
    if (m15) labels.push({ text: m15 === "PASS" ? "M15 CONFIRM" : `M15 ${m15}`, tone: toneOfStatus(m15) });
    const m1 = String(intel.m1 ?? "").toUpperCase();
    if (m1 && m1 !== "PASS") labels.push({ text: "WAIT M1 ENTRY", tone: "orange" });

    const bos = String(intel.bos ?? "").toUpperCase();
    if (bos === "PASS" || bos === "TRUE") labels.push({ text: "BOS/CHoCH", tone: "green" });
    else if (bos === "FAIL" || bos === "FALSE") labels.push({ text: "NO BOS/CHoCH", tone: "red" });

    const ob = String(intel.obFvg ?? "").toUpperCase();
    if (ob === "PASS" || ob === "TRUE") labels.push({ text: "OB/FVG", tone: "green" });
    else if (ob === "FAIL" || ob === "FALSE") labels.push({ text: "NO OB/FVG", tone: "red" });

    if (intel.liquiditySweep) labels.push({ text: "LIQUIDITY SWEEP", tone: "green" });

    const td = String(intel.topDownStatus ?? "").toUpperCase();
    if (td) labels.push({ text: `TOP-DOWN ${td}`, tone: toneOfStatus(td) });
  }

  if (toggles.quantLabels) {
    const qs = String(q.signal ?? "").toUpperCase();
    if (qs === "CONFIRM_BUY") labels.push({ text: "QUANT BUY", tone: "green" });
    else if (qs === "CONFIRM_SELL") labels.push({ text: "QUANT SELL", tone: "green" });
    else if (qs === "WAIT") labels.push({ text: "QUANT WAIT", tone: "orange" });
    const qpDir = String(qp.signal ?? qp.direction ?? "").toUpperCase();
    if (qpDir.includes("BUY")) labels.push({ text: "QUANT PRO TREND BUY", tone: "green" });
    if (qpDir.includes("SELL")) labels.push({ text: "QUANT PRO TREND SELL", tone: "green" });
  }

  if (toggles.accelBands) {
    const a = String(intel.accelStatus ?? "").toUpperCase();
    if (a.includes("BULL")) labels.push({ text: "ACCEL BANDS HTF BULLISH", tone: "green" });
    else if (a.includes("BEAR")) labels.push({ text: "ACCEL BANDS HTF BEARISH", tone: "red" });
  }

  if (!labels.length) return null;

  return (
    <div className="absolute top-1 left-1 z-10 flex flex-col items-start gap-0.5 pointer-events-none max-w-[60%]">
      <div className="flex flex-wrap gap-0.5">
        {labels.map((l, i) => (
          <Badge key={i} value={l.text} tone={l.tone} />
        ))}
      </div>
    </div>
  );
}

function WspOverlayZones({ intel, toggles }: { intel: ReturnType<typeof useWspIntel>; toggles: ToggleState }) {
  const items: { label: string; value: any; tone: Tone }[] = [];
  if (toggles.entryPlan) {
    if (intel.entry != null) items.push({ label: "Entry", value: intel.entry, tone: "gray" });
    if (intel.sl != null) items.push({ label: "SL", value: intel.sl, tone: "red" });
    if (intel.tp1 != null) items.push({ label: "TP1", value: intel.tp1, tone: "green" });
    if (intel.tp2 != null) items.push({ label: "TP2", value: intel.tp2, tone: "green" });
    if (intel.tp3 != null) items.push({ label: "TP3", value: intel.tp3, tone: "green" });
  }
  if (toggles.smartMoneyZones) {
    if (intel.h4Demand != null) items.push({ label: "H4 Demand", value: intel.h4Demand, tone: "green" });
    if (intel.h4Supply != null) items.push({ label: "H4 Supply", value: intel.h4Supply, tone: "red" });
    if (intel.fvg1h != null) items.push({ label: "FVG 1H", value: intel.fvg1h, tone: "orange" });
    if (intel.ote != null) items.push({ label: "OTE", value: intel.ote, tone: "orange" });
    if (intel.smEnter != null) items.push({ label: "SM Enter", value: intel.smEnter, tone: "green" });
    if (intel.smExit != null) items.push({ label: "SM Exit", value: intel.smExit, tone: "red" });
  }
  if (toggles.accelBands) {
    if (intel.accelUpper != null) items.push({ label: "AB Upper", value: intel.accelUpper, tone: "gray" });
    if (intel.accelMiddle != null) items.push({ label: "AB Mid", value: intel.accelMiddle, tone: "gray" });
    if (intel.accelLower != null) items.push({ label: "AB Lower", value: intel.accelLower, tone: "gray" });
  }
  if (!items.length) return null;
  return (
    <div className="border-t border-dashed border-black/40 mt-1 pt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-mono">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-2 border-b border-dotted border-black/20 py-0.5">
          <span className="opacity-70 uppercase tracking-wider">{it.label}</span>
          <span className={
            it.tone === "green" ? "text-profit" :
            it.tone === "red" ? "text-loss" : ""
          }>
            {typeof it.value === "object" ? JSON.stringify(it.value) : String(it.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MissingConfirmationsBox({ intel }: { intel: ReturnType<typeof useWspIntel> }) {
  const missing: string[] = [];
  const checks: [string, any][] = [
    ["M1 ENTRY", intel.m1],
    ["BOS/CHoCH", intel.bos],
    ["OB/FVG", intel.obFvg],
    ["MTFA", intel.mtfaStatus],
    ["SMC", intel.smcStatus],
  ];
  for (const [name, v] of checks) {
    const s = String(v ?? "").toUpperCase();
    if (!s || s === "FAIL" || s === "WAIT" || s === "FALSE" || s === "UNKNOWN") missing.push(name);
  }
  const fromBackend = Array.isArray(intel.missingConfirmations)
    ? intel.missingConfirmations.map((x: any) => String(x).toUpperCase())
    : [];
  const all = Array.from(new Set([...fromBackend, ...missing]));

  if (intel.allowDemo) {
    return (
      <div className="mt-1 border border-black bg-emerald-200 text-emerald-900 px-2 py-1 text-[10px] uppercase tracking-widest text-center font-bold">
        DEMO ENTRY ALLOWED
      </div>
    );
  }
  const waitingTopDown = !intel.topDownPresent;
  const headline = waitingTopDown
    ? "WAITING FOR TOP-DOWN READER DATA — NO DEMO ENTRY YET"
    : intel.backendDecision === "ENTER_ANALYSIS_ONLY"
      ? "ANALYSIS ONLY — NO DEMO ENTRY YET"
      : "WAITING CONFIRMATION — NO DEMO ENTRY YET";
  return (
    <div className="mt-1 border border-black bg-yellow-100 text-black px-2 py-1 text-[10px] uppercase tracking-widest">
      <div className="font-bold">{headline}</div>
      <div className="opacity-80 mt-0.5">
        Missing: {all.length ? all.join(", ") : "Waiting data"}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Intelligence side panel (TradingView style)
// ─────────────────────────────────────────────────────────────

export function WspIntelligencePanel() {
  const intel = useWspIntel();
  const q = useQuantData();
  const qp = useQuantProData();

  const Row = ({ k, v, tone }: { k: string; v: any; tone?: Tone }) => (
    <div className="flex items-center justify-between gap-2 border-b border-dashed border-black/30 py-0.5">
      <span className="text-[9px] uppercase opacity-70 tracking-wider">{k}</span>
      {tone ? (
        <Badge value={String(v ?? "Waiting data").toUpperCase()} tone={tone} />
      ) : (
        <span className="pixel text-[11px]">{v ?? "Waiting data"}</span>
      )}
    </div>
  );

  const safetyTone = toneOfStatus(intel.safetyGuard);
  const trapTone = (() => {
    const v = String(intel.trapCheck ?? "").toUpperCase();
    if (v === "VALID" || v === "OK") return "green" as const;
    if (v.includes("TRAP")) return "red" as const;
    return "gray" as const;
  })();

  return (
    <Panel title="INTELLIGENCE" right="WSP">
      <Row k="Market State" v={intel.marketState} tone={toneOfStatus(intel.marketState)} />
      <Row k="HTF Trend" v={intel.htfTrend} tone={toneOfStatus(intel.htfTrend)} />
      <Row k="MM Sentiment" v={intel.mmSentiment} tone={toneOfStatus(intel.mmSentiment)} />
      <Row k="Vol Pressure" v={intel.volPressure ?? "Waiting data"} />
      <Row k="Risk Score" v={intel.riskScore != null ? `${intel.riskScore} / 10` : "Waiting data"} />
      <Row k="Whale Act" v={intel.whaleAct} tone={toneOfStatus(intel.whaleAct)} />
      <Row k="Safety Guard" v={intel.safetyGuard ?? "Waiting data"} tone={safetyTone} />
      <Row k="Trap Check" v={intel.trapCheck ?? "VALID"} tone={trapTone} />
      <Row k="Z-Score" v={fmtN(intel.zScore, 2)} />
      <Row k="Stable Dom" v={intel.stableDom} tone={toneOfStatus(intel.stableDom)} />
      <Row k="SM Action" v={intel.smAction} tone={toneOfStatus(intel.smAction)} />
      <div className="border-t border-black mt-1 pt-1">
        <Row k="Top-Down Score" v={intel.topDownScore != null ? `${intel.topDownScore}/100` : "Waiting data"} />
        <Row k="Quant Score" v={q.score != null ? `${q.score}/100` : "Waiting data"} />
        <Row k="Quant PRO Score" v={qp.score != null ? `${qp.score}/100` : "Waiting data"} />
      </div>
      {intel.narrative && (
        <div className="mt-1 text-[10px] italic opacity-80 border-t border-dashed border-black/40 pt-1">
          "{String(intel.narrative)}"
        </div>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────
// Top WSP ribbon (extends ConfirmationRibbon with WSP cells)
// ─────────────────────────────────────────────────────────────

export function WspRibbon() {
  const intel = useWspIntel();
  const cell = (label: string, val: any, tone?: Tone) => (
    <div className="flex items-center gap-1 px-2 border-r border-black/40 last:border-r-0 whitespace-nowrap">
      <span className="opacity-60">{label}</span>
      {tone ? <Badge value={String(val ?? "—").toUpperCase()} tone={tone} /> : <b>{val ?? "—"}</b>}
    </div>
  );
  const safe = String(intel.safetyGuard ?? "").toUpperCase();
  const wspTone: Tone = safe === "SECURE" || safe === "OK" ? "green" : safe === "DANGER" ? "red" : "gray";
  const DEMO_MAX_LOT = 0.01;
  const rawLotVal = pickFrom(intel.raw, "raw_lot", "calculated_lot", "kelly_suggested_lot", "theoretical_lot");
  const capRaw = intel.lot;
  const execLotNum = capRaw != null ? Math.min(Number(capRaw), DEMO_MAX_LOT) : null;
  return (
    <div className="border border-black bg-secondary text-[10px] uppercase tracking-widest flex flex-wrap items-center py-1">
      {cell("WSP", safe || "—", wspTone)}
      {cell("REGIME", String(intel.marketState ?? "—").toUpperCase(), toneOfStatus(intel.marketState))}
      {cell("TRAP", String(intel.trapCheck ?? "VALID").toUpperCase(), toneOfStatus(intel.trapCheck))}
      {cell("Z", fmtN(intel.zScore, 2))}
      {cell("RR", intel.rr ?? "—")}
      {cell("SPREAD", intel.spread ?? "—")}
      {cell("LOT", execLotNum != null ? execLotNum.toFixed(2) : "—")}
      {cell("RAW LOT", rawLotVal != null ? Number(rawLotVal).toFixed(4) : "—")}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Toggle bar
// ─────────────────────────────────────────────────────────────

const DEFAULT_TOGGLES: ToggleState = {
  wspLabels: true,
  topDownLabels: true,
  quantLabels: true,
  smartMoneyZones: true,
  accelBands: true,
  entryPlan: true,
  missing: true,
};

function TogglesBar({ value, onChange }: { value: ToggleState; onChange: (t: ToggleState) => void }) {
  const items: { k: keyof ToggleState; label: string }[] = [
    { k: "wspLabels", label: "WSP Labels" },
    { k: "topDownLabels", label: "Top-Down Labels" },
    { k: "quantLabels", label: "Quant Labels" },
    { k: "smartMoneyZones", label: "Smart Money Zones" },
    { k: "accelBands", label: "Acceleration Bands" },
    { k: "entryPlan", label: "Entry Plan" },
    { k: "missing", label: "Missing Confirmations" },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-widest border border-dashed border-black/40 px-2 py-1 mb-1">
      {items.map((it) => (
        <label key={it.k} className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={value[it.k]}
            onChange={(e) => onChange({ ...value, [it.k]: e.target.checked })}
            className="accent-black"
          />
          {it.label}
        </label>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Workspace wrapper (chart + ribbon + overlays + side panel + toggles)
// ─────────────────────────────────────────────────────────────

export function WspChartWorkspace({ symbol = "BTCUSD", timeframe = "M5" }: { symbol?: string; timeframe?: string }) {
  const [toggles, setToggles] = useState<ToggleState>(DEFAULT_TOGGLES);
  const intel = useWspIntel();

  return (
    <div className="grid grid-cols-12 gap-3">
      <Panel
        title={`${symbol} / USD · 5-MIN — WSP MAIN CHART`}
        right={intel.allowDemo ? "DEMO ENTRY ALLOWED" : intel.topDownPresent ? "READ-ONLY · WAITING CONFIRMATION" : "READ-ONLY · WAITING TOP-DOWN"}
        className="col-span-9"
      >
        <TogglesBar value={toggles} onChange={setToggles} />
        <WspRibbon />
        <div className="mt-1"><ConfirmationRibbon /></div>
        <div className="relative mt-1">
          <WspOverlayLabels intel={intel} toggles={toggles} />
          <CandleChart symbol={symbol} timeframe={timeframe} variant="main" />
        </div>
        <WspOverlayZones intel={intel} toggles={toggles} />
        {toggles.missing && <MissingConfirmationsBox intel={intel} />}
      </Panel>

      <div className="col-span-3">
        <WspIntelligencePanel />
      </div>
    </div>
  );
}
