import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, gradeTone, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useQuantData, signalTone as quantSignalTone } from "./QuantStrategy";

const ACTIVE = ["QUANT_STATISTICAL_PULLBACK", "BREAKOUT_RETEST", "CRT_TBS_REVERSAL", "AMD_FVG_IFVG_REVERSAL", "FIB_OTE_RETEST", "EMA_PULLBACK"] as const;
const LEGACY = ["SECOND_ENTRY", "SCALPING_AGENT"] as const;

const ROLES: Record<string, "ENTRY_STRATEGY" | "CONFIRMATION_ONLY" | "LEGACY_OBSERVER"> = {
  QUANT_STATISTICAL_PULLBACK: "ENTRY_STRATEGY",
  BREAKOUT_RETEST: "ENTRY_STRATEGY",
  CRT_TBS_REVERSAL: "ENTRY_STRATEGY",
  AMD_FVG_IFVG_REVERSAL: "ENTRY_STRATEGY",
  FIB_OTE_RETEST: "ENTRY_STRATEGY",
  EMA_PULLBACK: "CONFIRMATION_ONLY",
  SECOND_ENTRY: "LEGACY_OBSERVER",
  SCALPING_AGENT: "LEGACY_OBSERVER",
};
function roleTone(r: string) {
  if (r === "ENTRY_STRATEGY") return "green";
  if (r === "CONFIRMATION_ONLY") return "yellow";
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

function StrategyCard({ name, sig, kind }: { name: string; sig: any | undefined; kind: "ACTIVE" | "LEGACY" }) {
  const rp = sig?.raw_payload ?? {};
  const statusTxt = kind === "LEGACY" ? "LEGACY_OBSERVER" : unknownIf(rp.strategy_status ?? sig?.status ?? "ACTIVE");
  const tone = kind === "LEGACY" ? "gray" : statusTone(String(statusTxt));

  const signal = unknownIf(sig?.signal);
  const conf = sig?.confidence ?? rp.confidence;
  const setupGrade = unknownIf(rp.big_setup_grade ?? rp.setup_grade);
  const safety = unknownIf(rp.safety_guard_status);
  const riskDiag = unknownIf(rp.risk_diag_status ?? rp.risk_status);
  const strategyScore = rp.strategy_score;
  const skipReason = (["WAIT", "SKIP", "SKIPPED"].includes(String(signal).toUpperCase()))
    ? unknownIf(sig?.blocked_reason ?? rp.skip_reason ?? sig?.reason)
    : null;

  const role = ROLES[name] ?? "LEGACY_OBSERVER";
  const entryAllowed = role === "ENTRY_STRATEGY" && kind === "ACTIVE";

  return (
    <div className={`border ${kind === "LEGACY" ? "border-dashed border-black/60 opacity-80" : "border-black"} p-2`}>
      <div className="flex items-center justify-between">
        <div className="font-bold text-[11px]">{name}</div>
        <Badge value={String(statusTxt)} tone={tone as any} />
      </div>
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

export function StrategyModules() {
  const { rows, empty } = useLiveTable<any>("strategy_signals", { limit: 100 });
  const latest = pickLatest(rows);

  return (
    <Panel title="STRATEGY MODULES" right="ACTIVE + LEGACY OBSERVER">
      {empty ? (
        <Waiting />
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Active Strategies</div>
          <div className="grid grid-cols-5 gap-2">
            {ACTIVE.map((name) => (
              <StrategyCard key={name} name={name} sig={latest[name]} kind="ACTIVE" />
            ))}
          </div>
          <div className="text-[10px] uppercase tracking-widest opacity-70 mt-3 mb-1">Legacy Observer (Disabled for Paper Entry)</div>
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
