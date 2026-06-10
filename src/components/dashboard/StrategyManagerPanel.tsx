import { Panel, KV } from "@/components/dashboard/Panel";
import { Badge, statusTone, gradeTone } from "@/components/dashboard/Badges";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useQuantData, useQuantProData, signalTone as quantSignalTone } from "@/components/dashboard/QuantStrategy";
import { normalizeSymbol } from "@/lib/symbol";

/* ============================================================================
 * UNIFIED STRATEGIES PANEL
 * Merges Strategy Manager roster + Strategy Modules detail into ONE
 * per-strategy list. Each strategy appears exactly once.
 * ========================================================================== */

type Strat = {
  name: string;
  mode?: string;
  route_allowed?: boolean;
  enabled?: boolean;
  role?: string;
  allowed_symbols?: string[] | string;
  last_status?: string;
  last_reason?: string;
  stale?: boolean;
  last_update?: string;
};

const EXECUTOR_DEFAULT = [
  "SIMO_ATM_BREAKOUT",
  "BTC_SCALPING_AGENT",
  "EUR_EMA_RSI_ATR_CROSSOVER",
  "GOLD_LIQUIDITY_HUNTER_PRO",
  "GOLD_M1_M5_EMA_SWEEP_SCALPER",
  "GOLD_ORDER_FLOW_CVD_VWAP",
  "TREND_CONTINUATION_BREAKDOWN",
  "BREAKOUT_RETEST",
  "CRT_TBS_REVERSAL",
  "AMD_FVG_IFVG_REVERSAL",
  "FIB_OTE_RETEST",
  "QUANT_STATISTICAL_PULLBACK",
  "QUANT_PRO_REGIME_SWITCHING",
];

const OBSERVER_DEFAULT = [
  "ORDER_FLOW_READER",
  "TOP_DOWN_MARKET_READER",
  "SMC_TAGGER",
  "MTFA",
  "MTF_STRUCTURE",
  "BIG_SETUP_DETECTOR",
  "SECOND_ENTRY",
  "SCALPING_AGENT",
  "EMA_PULLBACK",
  "ACCELERATION_BANDS_HTF",
];

function pickList(sm: any, key: string): Strat[] {
  const raw = sm?.[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s: any) => (typeof s === "string" ? { name: s } : s));
  if (typeof raw === "object") return Object.entries(raw).map(([name, v]: [string, any]) => ({ name, ...(v ?? {}) }));
  return [];
}

function unknownIf(v: any) {
  return v == null || v === "" ? "UNKNOWN" : v;
}

function ageSeconds(stamp: any): number | null {
  if (!stamp) return null;
  const t = Date.parse(String(stamp).replace(" ", "T"));
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

function ageLabel(sec: number): string {
  if (sec < 90) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

const STALE_SEC = 120;

/* -------------------------- per-strategy extras -------------------------- */

function CrtExtras({ rp }: { rp: any }) {
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <KV k="CRT Score" v={unknownIf(rp.crt_tbs_score)} />
      <KV k="Bias" v={unknownIf(rp.crt_tbs_bias)} />
      <KV k="Zone" v={unknownIf(rp.crt_price_zone)} />
    </div>
  );
}
function AmdExtras({ rp }: { rp: any }) {
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <KV k="AMD/FVG Score" v={unknownIf(rp.amd_fvg_score)} />
      <KV k="Phase" v={unknownIf(rp.amd_phase_detected)} />
      <KV k="Displacement" v={unknownIf(rp.displacement_detected)} />
    </div>
  );
}
function OteExtras({ rp }: { rp: any }) {
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <KV k="OTE Score" v={unknownIf(rp.fib_ote_score)} />
      <KV k="Zone" v={unknownIf(rp.fib_ote_zone)} />
      <KV k="0.618" v={unknownIf(rp.fib_ote_618)} />
      <KV k="0.786" v={unknownIf(rp.fib_ote_786)} />
    </div>
  );
}
function GoldZonesExtras({ rp }: { rp: any }) {
  const g = rp?.gold_order_flow_cvd_vwap ?? rp?.GOLD_ORDER_FLOW_CVD_VWAP ?? rp ?? {};
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <KV k="POC" v={unknownIf(g.poc)} />
      <KV k="VAH" v={unknownIf(g.vah)} />
      <KV k="VAL" v={unknownIf(g.val)} />
      <KV k="VWAP" v={unknownIf(g.vwap)} />
      <KV k="CVD Slope" v={unknownIf(g.cvd_slope)} />
    </div>
  );
}
function GoldLiqExtras({ rp }: { rp: any }) {
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <KV k="Sweep" v={unknownIf(rp.liquidity_sweep)} />
      <KV k="Zone" v={unknownIf(rp.liquidity_zone)} />
      <KV k="Reversal" v={unknownIf(rp.reversal_signal)} />
    </div>
  );
}
function QuantExtras() {
  const q = useQuantData();
  if (!q.has_any) return null;
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <div className="flex flex-wrap gap-1">
        <Badge value={`SIG: ${String(q.signal ?? "—").toUpperCase()}`} tone={quantSignalTone(q.signal)} />
      </div>
      <KV k="Score" v={q.score != null ? `${q.score}/100` : "—"} />
      <KV k="R²" v={q.r2 != null ? Number(q.r2).toFixed(2) : "—"} />
      <KV k="Z-Score" v={q.z != null ? Number(q.z).toFixed(2) : "—"} />
    </div>
  );
}
function QuantProExtras() {
  const q = useQuantProData();
  if (!q.has_any) return null;
  return (
    <div className="mt-1 border-t border-dashed border-black/40 pt-1 text-[10px] space-y-0.5">
      <KV k="Regime" v={String(q.regime ?? "—").toUpperCase()} />
      <KV k="Score" v={q.score != null ? `${q.score}/100` : "—"} />
      <KV k="Grade" v={q.grade ?? "—"} />
      <KV k="Hurst" v={q.hurst != null ? Number(q.hurst).toFixed(2) : "—"} />
    </div>
  );
}

function StrategyExtras({ name, sig }: { name: string; sig: any }) {
  const rp = sig?.raw_payload ?? {};
  if (name === "CRT_TBS_REVERSAL") return <CrtExtras rp={rp} />;
  if (name === "AMD_FVG_IFVG_REVERSAL") return <AmdExtras rp={rp} />;
  if (name === "FIB_OTE_RETEST") return <OteExtras rp={rp} />;
  if (name === "GOLD_ORDER_FLOW_CVD_VWAP") return <GoldZonesExtras rp={rp} />;
  if (name === "GOLD_LIQUIDITY_HUNTER_PRO") return <GoldLiqExtras rp={rp} />;
  if (name === "QUANT_STATISTICAL_PULLBACK") return <QuantExtras />;
  if (name === "QUANT_PRO_REGIME_SWITCHING") return <QuantProExtras />;
  return null;
}

/* ------------------------------- card row -------------------------------- */

function StrategyCard({
  meta,
  sig,
  observer,
  backendStale,
}: {
  meta: Strat;
  sig: any | undefined;
  observer: boolean;
  backendStale: boolean;
}) {
  const rp = sig?.raw_payload ?? {};
  const role = (meta.role ?? (observer ? "OBSERVER" : "EXECUTOR")).toUpperCase();
  const routeAllowed = observer ? false : (meta.route_allowed ?? true);
  const signal = unknownIf(sig?.signal);
  const conf = sig?.confidence ?? rp.confidence;
  const skipReason = (["WAIT", "SKIP", "SKIPPED", "BLOCKED"].includes(String(signal).toUpperCase()))
    ? unknownIf(sig?.blocked_reason ?? rp.skip_reason ?? sig?.reason ?? meta.last_reason)
    : null;
  const setupGrade = rp.big_setup_grade ?? rp.setup_grade;
  const lastStamp = sig?.created_at ?? meta.last_update ?? null;
  const localAge = ageSeconds(lastStamp);
  const cardStale = backendStale || meta.stale === true || (localAge != null && localAge > STALE_SEC);

  const borderClr = observer ? "border-black/60" : "border-black";
  const tone = observer ? "gray" : routeAllowed ? "green" : "red";

  return (
    <div
      className={`border ${borderClr} ${observer ? "border-dashed" : ""} p-2`}
      style={cardStale ? { opacity: 0.55 } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-[11px] truncate flex items-center gap-1" title={meta.name}>
          <span aria-hidden style={{ color: "var(--hx-dim)" }}>🔒</span>
          {meta.name}
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          <Badge value={observer ? "OBSERVER" : "EXECUTOR"} tone={observer ? "gray" : "green"} />
          <Badge value={routeAllowed ? "ROUTE: YES" : "ROUTE: NO"} tone={tone as any} />
          {cardStale && (
            <Badge
              value={`STALE${localAge != null ? ` · ${ageLabel(localAge)}` : ""}`}
              tone="orange"
            />
          )}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px]">
        <KV k="Role" v={role} />
        <KV k="Signal" v={String(signal)} />
        <KV k="Confidence" v={conf != null ? `${conf}%` : "UNKNOWN"} />
        {setupGrade != null && (
          <KV k="Setup" v={<Badge value={String(setupGrade)} tone={gradeTone(setupGrade)} />} />
        )}
      </div>

      <StrategyExtras name={meta.name} sig={sig} />

      {skipReason && (
        <div className="mt-1 text-[10px] opacity-80"><b>SKIP:</b> {String(skipReason)}</div>
      )}
      {!skipReason && (sig?.reason ?? meta.last_reason) && (
        <div className="mt-1 text-[10px] opacity-80 italic line-clamp-2">
          "{String(sig?.reason ?? meta.last_reason)}"
        </div>
      )}

      {/* strategy-specific flags only — generic DEMO_ONLY/MAX_LOT/MAGIC removed */}
      {meta.name === "ORDER_FLOW_READER" && (
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge value="MICRO_DISCOVERY_OBSERVE_ONLY" tone="orange" />
        </div>
      )}
      {!observer && (meta.name === "GOLD_LIQUIDITY_HUNTER_PRO" || meta.name === "GOLD_ORDER_FLOW_CVD_VWAP") && (
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge value="QUICK_EXIT_ENABLED" tone="yellow" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------- panel --------------------------------- */

export function StrategyManagerPanel() {
  const ds: any = useDashboardStatusPayload();
  const sm =
    ds.strategy_manager ??
    ds.STRATEGY_MANAGER ??
    ds.raw_payload?.strategy_manager ??
    {};

  const { rows: sigs } = useLiveTable<any>("strategy_signals", { limit: 200 });
  const { rows: dec } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const backendActiveSymbol = dec[0]?.symbol ?? ds.active_symbol ?? null;

  const health = useBackendHealth();
  const backendStale = health.verdict !== "ONLINE";

  // latest signal per strategy
  const latestSig: Record<string, any> = {};
  for (const r of sigs) {
    const n = (r.strategy ?? "").toString();
    if (n && !latestSig[n]) latestSig[n] = r;
  }

  const execRaw = [
    ...pickList(sm, "active_execution"),
    ...pickList(sm, "ACTIVE_EXECUTION"),
    ...pickList(sm, "active"),
  ];
  const obsRaw = [
    ...pickList(sm, "observation_only"),
    ...pickList(sm, "OBSERVATION_ONLY"),
    ...pickList(sm, "observe"),
    ...pickList(sm, "observers"),
  ];

  const execMap = new Map<string, Strat>();
  execRaw.forEach((s) => execMap.set(s.name, s));
  const obsMap = new Map<string, Strat>();
  obsRaw.forEach((s) => obsMap.set(s.name, s));

  const executors: Strat[] = [];
  const seen = new Set<string>();
  for (const n of EXECUTOR_DEFAULT) {
    executors.push(execMap.get(n) ?? { name: n });
    seen.add(n);
  }
  execRaw.forEach((s) => { if (!seen.has(s.name)) { executors.push(s); seen.add(s.name); } });

  const observers: Strat[] = [];
  const oSeen = new Set<string>();
  for (const n of OBSERVER_DEFAULT) {
    if (seen.has(n)) continue;
    observers.push(obsMap.get(n) ?? { name: n });
    oSeen.add(n);
  }
  obsRaw.forEach((s) => { if (!seen.has(s.name) && !oSeen.has(s.name)) { observers.push(s); oSeen.add(s.name); } });

  const total = executors.length + observers.length;
  const sym = backendActiveSymbol ? normalizeSymbol(backendActiveSymbol) : "—";

  return (
    <Panel
      title="STRATEGIES — UNIFIED ROSTER"
      right={
        <div className="flex items-center gap-2">
          <Badge value={`BACKEND ACTIVE: ${sym}`} tone="gray" />
          <Badge value={`${executors.length} EXECUTOR · ${observers.length} OBSERVER · ${total} TOTAL`} tone="gray" />
          {backendStale && <Badge value="BACKEND STALE — ALL CARDS STALE" tone="orange" />}
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
            <Badge value="ACTIVE EXECUTION" tone="green" />
            <span className="opacity-60">routing to execution · {executors.length}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {executors.map((s) => (
              <StrategyCard
                key={s.name}
                meta={s}
                sig={latestSig[s.name]}
                observer={false}
                backendStale={backendStale}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
            <Badge value="OBSERVATION ONLY" tone="gray" />
            <span className="opacity-60">never route · {observers.length}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {observers.map((s) => (
              <StrategyCard
                key={s.name}
                meta={s}
                sig={latestSig[s.name]}
                observer={true}
                backendStale={backendStale}
              />
            ))}
          </div>
        </div>

        <div className="text-[9px] opacity-60 uppercase tracking-widest">
          🔒 demo-locked · execution only from backend DemoRouter · max_lot 0.01 · magic 909002
        </div>
      </div>
    </Panel>
  );
}
