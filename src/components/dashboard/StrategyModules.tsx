import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, gradeTone, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useQuantData, useQuantProData, signalTone as quantSignalTone } from "./QuantStrategy";
import { isSameSymbol, normalizeSymbol } from "@/lib/symbol";

// Generic strategies are DISABLED FOR GOLD — only GOLD_LIQUIDITY_HUNTER_PRO handles GOLD.
const GOLD_DISABLED_GENERICS = new Set([
  "TREND_CONTINUATION_BREAKDOWN",
  "QUANT_PRO_REGIME_SWITCHING",
  "QUANT_STATISTICAL_PULLBACK",
  "BREAKOUT_RETEST",
  "FIB_OTE_RETEST",
  "AMD_FVG_IFVG_REVERSAL",
  "CRT_TBS_REVERSAL",
]);

// BTC math audit override
const BTC_MATH_AUDIT_DISABLED = new Set(["QUANT_STATISTICAL_PULLBACK"]);


const ACTIVE = [
  "TREND_CONTINUATION_BREAKDOWN",
  "BREAKOUT_RETEST",
  "CRT_TBS_REVERSAL",
  "AMD_FVG_IFVG_REVERSAL",
  "FIB_OTE_RETEST",
  "QUANT_STATISTICAL_PULLBACK",
  "QUANT_PRO_REGIME_SWITCHING",
] as const;
const CONFIRMATION = ["EMA_PULLBACK", "ACCELERATION_BANDS_HTF", "TOP_DOWN_MARKET_READER"] as const;
const LEGACY = ["SECOND_ENTRY", "SCALPING_AGENT"] as const;

const ROLES: Record<string, "ENTRY_STRATEGY" | "CONFIRMATION_ONLY" | "OBSERVER_ONLY" | "MARKET_READER" | "HTF_CONFIRMATION"> = {
  TREND_CONTINUATION_BREAKDOWN: "ENTRY_STRATEGY",
  QUANT_STATISTICAL_PULLBACK: "ENTRY_STRATEGY",
  QUANT_PRO_REGIME_SWITCHING: "ENTRY_STRATEGY",
  BREAKOUT_RETEST: "ENTRY_STRATEGY",
  CRT_TBS_REVERSAL: "ENTRY_STRATEGY",
  AMD_FVG_IFVG_REVERSAL: "ENTRY_STRATEGY",
  FIB_OTE_RETEST: "ENTRY_STRATEGY",
  EMA_PULLBACK: "CONFIRMATION_ONLY",
  ACCELERATION_BANDS_HTF: "HTF_CONFIRMATION",
  TOP_DOWN_MARKET_READER: "MARKET_READER",
  SECOND_ENTRY: "OBSERVER_ONLY",
  SCALPING_AGENT: "OBSERVER_ONLY",
};
function roleTone(r: string) {
  if (r === "ENTRY_STRATEGY") return "green";
  if (r === "CONFIRMATION_ONLY" || r === "HTF_CONFIRMATION") return "yellow";
  if (r === "MARKET_READER") return "orange";
  return "gray";
}

function pickLatest(rows: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const r of rows) {
    if (!r.strategy) continue;
    if (!out[r.strategy]) out[r.strategy] = r;
  }
  return out;
}

function unknownIf(v: any) {
  return v == null || v === "" ? "UNKNOWN" : v;
}

function StrategyCard({ name, sig, kind, activeSymbol }: { name: string; sig: any | undefined; kind: "ACTIVE" | "CONFIRMATION" | "LEGACY"; activeSymbol?: string | null }) {
  const rp = sig?.raw_payload ?? {};
  const role = ROLES[name] ?? "OBSERVER_ONLY";
  const isGold = activeSymbol ? isSameSymbol(activeSymbol, "GOLD") : false;
  const goldDisabled = isGold && GOLD_DISABLED_GENERICS.has(name);
  const btcMathAudit = !isGold && BTC_MATH_AUDIT_DISABLED.has(name);

  const defaultStatus =
    kind === "LEGACY" ? "OBSERVER_ONLY" :
    kind === "CONFIRMATION" ? role :
    "ACTIVE";
  const statusTxt = goldDisabled
    ? "DISABLED FOR GOLD"
    : btcMathAudit
      ? "DISABLED / MATH AUDIT"
      : kind !== "ACTIVE"
        ? defaultStatus
        : unknownIf(rp.strategy_status ?? sig?.status ?? "ACTIVE");
  const tone = goldDisabled || btcMathAudit
    ? "red"
    : kind === "LEGACY" ? "gray" : kind === "CONFIRMATION" ? "yellow" : statusTone(String(statusTxt));

  const signal = unknownIf(sig?.signal);
  const conf = sig?.confidence ?? rp.confidence;
  const setupGrade = unknownIf(rp.big_setup_grade ?? rp.setup_grade);
  const safety = unknownIf(rp.safety_guard_status);
  const riskDiag = unknownIf(rp.risk_diag_status ?? rp.risk_status);
  const strategyScore = rp.strategy_score;
  const skipReason = (["WAIT", "SKIP", "SKIPPED"].includes(String(signal).toUpperCase()))
    ? unknownIf(sig?.blocked_reason ?? rp.skip_reason ?? sig?.reason)
    : null;

  const entryAllowed = !goldDisabled && !btcMathAudit && role === "ENTRY_STRATEGY" && kind === "ACTIVE";

  return (
    <div className={`border ${goldDisabled || btcMathAudit ? "border-loss" : kind === "LEGACY" ? "border-dashed border-black/60 opacity-80" : "border-black"} p-2`}>
      <div className="flex items-center justify-between">
        <div className="font-bold text-[11px]">{name}</div>
        <Badge value={String(statusTxt)} tone={tone as any} />
      </div>
      {goldDisabled && (
        <div className="mt-1 text-[10px] text-loss uppercase tracking-widest">
          ⚠ {normalizeSymbol(activeSymbol)} — GOLD_GENERIC_STRATEGY_DISABLED
        </div>
      )}
      {btcMathAudit && (
        <div className="mt-1 text-[10px] text-loss uppercase tracking-widest">
          ⚠ BTC {name} — DISABLED / MATH AUDIT REQUIRED
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge value={`ROLE: ${role}`} tone={roleTone(role) as any} />
        <Badge value={`ENTRY: ${entryAllowed ? "ALLOWED" : "BLOCKED"}`} tone={entryAllowed ? "green" : "red"} />
        <Badge value={`SETUP: ${setupGrade}`} tone={gradeTone(setupGrade)} />
        <Badge value={`SAFETY: ${safety}`} tone={statusTone(safety)} />
        <Badge value={`RISK: ${riskDiag}`} tone={statusTone(riskDiag)} />
      </div>
      <div className="mt-1.5 space-y-0.5">
        <KV k="Signal" v={String(signal)} />
        <KV k="Confidence" v={conf != null ? `${conf}%` : "UNKNOWN"} />
        {strategyScore != null && <KV k="Score" v={String(strategyScore)} />}
        <KV k="Win Rate" v={sig?.win_rate != null ? `${sig.win_rate}%` : "UNKNOWN"} />
        <KV
          k="Today PnL"
          v={sig?.pnl != null ? `${sig.pnl >= 0 ? "+" : ""}$${Number(sig.pnl).toFixed(2)}` : "UNKNOWN"}
          accent={sig?.pnl != null ? (sig.pnl >= 0 ? "profit" : "loss") : undefined}
        />
      </div>

      {name === "CRT_TBS_REVERSAL" && (
        <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
          <KV k="CRT Score" v={unknownIf(rp.crt_tbs_score)} />
          <KV k="Bias" v={unknownIf(rp.crt_tbs_bias)} />
          <KV k="Zone" v={unknownIf(rp.crt_price_zone)} />
          <KV k="High" v={unknownIf(rp.crt_high)} />
          <KV k="Low" v={unknownIf(rp.crt_low)} />
          <KV k="Mid 50" v={unknownIf(rp.crt_mid_50)} />
          {rp.crt_tbs_reason && <div className="italic opacity-80">"{rp.crt_tbs_reason}"</div>}
        </div>
      )}

      {name === "AMD_FVG_IFVG_REVERSAL" && (
        <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
          <KV k="AMD/FVG Score" v={unknownIf(rp.amd_fvg_score)} />
          <KV k="AMD Phase" v={unknownIf(rp.amd_phase_detected)} />
          <KV k="Manipulation" v={unknownIf(rp.manipulation_detected)} />
          <KV k="Displacement" v={unknownIf(rp.displacement_detected)} />
          <KV k="FVG/IFVG Ctx" v={unknownIf(rp.fvg_ifvg_context)} />
          {rp.amd_fvg_reason && <div className="italic opacity-80">"{rp.amd_fvg_reason}"</div>}
        </div>
      )}

      {name === "FIB_OTE_RETEST" && (
        <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
          <KV k="OTE Score" v={unknownIf(rp.fib_ote_score)} />
          <KV k="Zone" v={unknownIf(rp.fib_ote_zone)} />
          <KV k="Bias" v={unknownIf(rp.fib_ote_bias)} />
          <KV k="0.618" v={unknownIf(rp.fib_ote_618)} />
          <KV k="0.786" v={unknownIf(rp.fib_ote_786)} />
          {rp.fib_ote_reason && <div className="italic opacity-80">"{rp.fib_ote_reason}"</div>}
        </div>
      )}

      {name === "EMA_PULLBACK" && (
        <div className="mt-1 text-[10px] border border-dashed border-black/60 px-1 py-0.5 uppercase tracking-wider">
          ⚠ EMA_PULLBACK REQUIRES EXTRA CONFIRMATION.
        </div>
      )}

      {name === "QUANT_STATISTICAL_PULLBACK" && <QuantExtras />}
      {name === "QUANT_PRO_REGIME_SWITCHING" && <QuantProExtras />}


      {skipReason && (
        <div className="mt-1 text-[10px] opacity-80"><b>SKIP:</b> {String(skipReason)}</div>
      )}
      {!skipReason && sig?.reason && (
        <div className="mt-1 text-[10px] opacity-80 italic line-clamp-2">"{sig.reason}"</div>
      )}
      {kind === "LEGACY" && (
        <div className="mt-1 text-[10px] uppercase opacity-80">LEGACY OBSERVER — NO PAPER ENTRIES</div>
      )}
    </div>
  );
}

function QuantExtras() {
  const q = useQuantData();
  if (!q.has_any) {
    return (
      <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] italic opacity-70">
        Waiting for Quant data
      </div>
    );
  }
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <div className="flex flex-wrap gap-1">
        <Badge value={`SIG: ${String(q.signal ?? "—").toUpperCase()}`} tone={quantSignalTone(q.signal)} />
      </div>
      <KV k="Score" v={q.score != null ? `${q.score}/100` : "—"} />
      <KV k="R²" v={q.r2 != null ? Number(q.r2).toFixed(2) : "—"} />
      <KV k="Z-Score" v={q.z != null ? Number(q.z).toFixed(2) : "—"} />
      <KV k="Slope" v={q.slope != null ? Number(q.slope).toFixed(4) : "—"} />
      {q.reason && <div className="italic opacity-80">"{String(q.reason)}"</div>}
    </div>
  );
}

function QuantProExtras() {
  const q = useQuantProData();
  if (!q.has_any) {
    return (
      <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] italic opacity-70">
        Waiting for Quant PRO data
      </div>
    );
  }
  const sigStr = String(q.signal ?? q.direction ?? "—").toUpperCase();
  const tone: "green" | "orange" | "red" | "gray" = (() => {
    if (sigStr === "CONFLICT" || sigStr === "FAIL") return "red";
    const sc = Number(q.score);
    if (Number.isFinite(sc) && sc >= 75 && (sigStr.includes("BUY") || sigStr.includes("SELL"))) return "green";
    if (sigStr === "WAIT" || sigStr === "FLAT" || sigStr === "NO_EDGE") return "orange";
    if (sigStr.includes("BUY") || sigStr.includes("SELL")) return "green";
    return "gray";
  })();
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <div className="flex flex-wrap gap-1">
        <Badge value={`REGIME: ${String(q.regime ?? "—").toUpperCase()}`} tone={String(q.regime).toUpperCase() === "FLAT" ? "orange" : "green"} />
        <Badge value={`SIG: ${sigStr}`} tone={tone} />
      </div>
      <KV k="Score" v={q.score != null ? `${q.score}/100` : "—"} />
      <KV k="Grade" v={q.grade ?? "—"} />
      <KV k="OLS t" v={q.ols_tstat != null ? Number(q.ols_tstat).toFixed(2) : "—"} />
      <KV k="Kalman Z" v={q.kalman_z != null ? Number(q.kalman_z).toFixed(2) : "—"} />
      <KV k="OU Half-Life" v={q.ou_half_life != null ? Number(q.ou_half_life).toFixed(2) : "—"} />
      <KV k="Hurst" v={q.hurst != null ? Number(q.hurst).toFixed(2) : "—"} />
      <KV k="EWMA Vol" v={q.ewma_vol != null ? Number(q.ewma_vol).toFixed(4) : "—"} />
      {q.reason && <div className="italic opacity-80">"{String(q.reason)}"</div>}
    </div>
  );
}

export function StrategyModules() {
  const { rows, empty } = useLiveTable<any>("strategy_signals", { limit: 100 });
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const activeSymbol = dec[0]?.symbol ?? null;
  const latest = pickLatest(rows);

  return (
    <Panel title="STRATEGY MODULES" right={`ACTIVE SYM: ${activeSymbol ? normalizeSymbol(activeSymbol) : "—"} · 7 ENTRY · 3 CONFIRMATION · 2 OBSERVER`}>
      {empty ? (
        <Waiting />
      ) : (
        <>
          {activeSymbol && isSameSymbol(activeSymbol, "GOLD") && (
            <div className="mb-2 border border-loss px-2 py-1 text-[10px] uppercase tracking-widest text-loss">
              ⚠ ACTIVE SYMBOL = GOLD — GENERIC ENTRY STRATEGIES DISABLED · ONLY GOLD_LIQUIDITY_HUNTER_PRO HANDLES GOLD ENTRIES
            </div>
          )}
          <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Active Entry Strategies (7)</div>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {ACTIVE.map((name) => (
              <StrategyCard key={name} name={name} sig={latest[name]} kind="ACTIVE" activeSymbol={activeSymbol} />
            ))}
          </div>
          <div className="text-[10px] uppercase tracking-widest opacity-70 mt-3 mb-1">Confirmation / Market Readers (3)</div>
          <div className="grid grid-cols-3 gap-2">
            {CONFIRMATION.map((name) => (
              <StrategyCard key={name} name={name} sig={latest[name]} kind="CONFIRMATION" activeSymbol={activeSymbol} />
            ))}
          </div>
          <div className="text-[10px] uppercase tracking-widest opacity-70 mt-3 mb-1">Observer Only (Disabled for Paper Entry)</div>
          <div className="grid grid-cols-2 gap-2">
            {LEGACY.map((name) => (
              <StrategyCard key={name} name={name} sig={latest[name]} kind="LEGACY" />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

