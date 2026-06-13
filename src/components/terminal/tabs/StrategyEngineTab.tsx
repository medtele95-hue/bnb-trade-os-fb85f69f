import * as React from "react";
import { Panel, KV, Chip, T, StatePanel, RoleBadge, DataStateBadge, fmtAge, ageSecFrom } from "../primitives";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDualHealth } from "../health";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

type Strategy = {
  name: string;
  enabled: boolean;
  route_allowed: boolean;
  last_decision?: string;
  last_confidence?: any;
  last_reason?: string;
  last_update?: any;
};

// Static registry mapped to backend STRATEGY_CLASS names. Source-of-truth for
// classification — backend payloads override per-strategy enabled/route flags
// when present.
const REGISTRY: Record<"ACTIVE" | "CONFIRM" | "FEED", { name: string; defaultEnabled: boolean }[]> = {
  ACTIVE: [
    { name: "BTC_SCALPING_AGENT", defaultEnabled: true },
    { name: "TREND_CONTINUATION_BREAKDOWN", defaultEnabled: true },
    { name: "BREAKOUT_RETEST", defaultEnabled: true },
    { name: "ORDER_FLOW_EXECUTION_AGENT", defaultEnabled: true },
    { name: "QUANT_PRO_REGIME_SWITCHING", defaultEnabled: true },
    { name: "SIMO_ATM_BREAKOUT", defaultEnabled: true },
    { name: "GOLD_LIQUIDITY_HUNTER", defaultEnabled: true },
    { name: "EUR_EMA_RSI_ATR", defaultEnabled: true },
  ],
  CONFIRM: [
    { name: "SMC_MTFA", defaultEnabled: true },
    { name: "CONFIRMATION_MATRIX", defaultEnabled: true },
    { name: "TIME_GATE", defaultEnabled: true },
    { name: "SPREAD_GATE", defaultEnabled: true },
    { name: "SAFETY_GUARD", defaultEnabled: true },
  ],
  FEED: [
    { name: "ORDER_FLOW_READER", defaultEnabled: true },
    { name: "MARKOV_ENGINE", defaultEnabled: true },
    { name: "KELLY_RISK", defaultEnabled: true },
    { name: "TIMEFRAME_HIERARCHY", defaultEnabled: true },
  ],
};

export function StrategyEngineTab() {
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 200 });
  const h = useDualHealth();

  const latestByStrategy = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const d of decisions) {
      const k = String(d.strategy ?? "").toUpperCase();
      const e = m.get(k);
      if (!e || new Date(d.created_at) > new Date(e.created_at)) m.set(k, d);
    }
    return m;
  }, [decisions]);

  const enrich = (n: { name: string; defaultEnabled: boolean }): Strategy => {
    const d = latestByStrategy.get(n.name.toUpperCase());
    return {
      name: n.name,
      enabled: n.defaultEnabled,
      route_allowed: n.name === "ORDER_FLOW_READER" ? false : n.defaultEnabled, // feeds never route
      last_decision: d?.decision,
      last_confidence: d?.confidence,
      last_reason: d?.reason,
      last_update: d?.created_at,
    };
  };

  return (
    <div className="flex flex-col gap-3">
      <FibConfluencePanel />
      <HermesPackPanel />
      <BalancedSelectorPanel />

      <Section
        title="ACTIVE EXECUTION STRATEGY"
        subtitle="Eligible to route candidates to the backend DemoRouter"
        items={REGISTRY.ACTIVE.map(enrich)}
        accent={T.acc}
        canRoute
        backendStale={h.backend !== "ONLINE"}
      />
      <Section
        title="CONFIRMATION MODULE"
        subtitle="Validates / blocks candidates but cannot execute"
        items={REGISTRY.CONFIRM.map(enrich)}
        accent={T.warn}
        canRoute={false}
        backendStale={h.backend !== "ONLINE"}
      />
      <Section
        title="INTERNAL DATA FEED"
        subtitle="Supplies numbers consumed by execution agents — never executes"
        items={REGISTRY.FEED.map(enrich)}
        accent={T.dim}
        canRoute={false}
        backendStale={h.backend !== "ONLINE"}
      />
    </div>
  );
}

function Section({
  title, subtitle, items, accent, canRoute, backendStale,
}: { title: string; subtitle: string; items: Strategy[]; accent: string; canRoute: boolean; backendStale: boolean }) {
  return (
    <Panel
      title={<span style={{ color: accent }}>{title}</span>}
      right={
        <>
          <RoleBadge>{canRoute ? "EXECUTABLE" : title.includes("FEED") ? "FEED ONLY" : "GATE ONLY"}</RoleBadge>
          {backendStale && <Chip tone="warn">BACKEND STALE</Chip>}
        </>
      }
    >
      <div className="text-[10.5px] mb-2 uppercase tracking-[0.14em]" style={{ color: T.dim }}>{subtitle}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {items.map((s) => (
          <StrategyCard key={s.name} s={s} canRoute={canRoute} backendStale={backendStale} />
        ))}
      </div>
    </Panel>
  );
}

function StrategyCard({ s, canRoute, backendStale }: { s: Strategy; canRoute: boolean; backendStale: boolean }) {
  const age = ageSecFrom(s.last_update);
  const stale = backendStale || (age != null && age > 600);
  const hasData = s.last_decision != null;
  return (
    <div
      className="p-2 flex flex-col gap-1"
      style={{
        background: T.panel2,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        opacity: stale ? 0.62 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold" style={{ color: T.txt, fontFamily: "Archivo" }}>{s.name}</span>
        <span title="Read-only / demo-locked" style={{ color: T.faint }}>🔒</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Chip tone={s.enabled ? "buy" : "dim"}>{s.enabled ? "ENABLED" : "DISABLED"}</Chip>
        {canRoute ? (
          <Chip tone={s.route_allowed ? "acc" : "dim"}>{s.route_allowed ? "ROUTE ALLOWED" : "ROUTE BLOCKED"}</Chip>
        ) : (
          <Chip tone="dim" outline>NO ROUTE</Chip>
        )}
        {stale && hasData && <Chip tone="warn">STALE · {fmtAge(age)}</Chip>}
        {!hasData && <Chip tone="dim" outline>NO DECISION</Chip>}
      </div>
      {hasData ? (
        <>
          <KV label="Last Decision" value={String(s.last_decision).replace(/_/g, " ")} />
          <KV label="Confidence" value={fmtConf(s.last_confidence)} />
          <KV label="Reason" value={s.last_reason ?? "—"} />
          <KV label="Age" value={fmtAge(age)} />
        </>
      ) : (
        <div className="text-[10px]" style={{ color: T.dim }}>
          No ai_decisions row found for this strategy.
        </div>
      )}
    </div>
  );
}

function fmtConf(c: any): string {
  if (c == null) return "—";
  const n = Number(c);
  if (!Number.isFinite(n)) return "—";
  return (n <= 1 ? n * 100 : n).toFixed(0) + "%";
}

function FibConfluencePanel() {
  const ds: any = useDashboardStatusPayload();
  const fc = ds?.fib_confluence;
  if (!fc) return (
    <Panel title="FIB CONFLUENCE" right={<RoleBadge>SETUP HUNTER MODULE</RoleBadge>}>
      <StatePanel state="NO_DATA" message="fib_confluence MISSING" />
    </Panel>
  );
  const dec = String(fc.last_decision ?? "").toUpperCase();
  const grade = String(fc.last_grade ?? "").toUpperCase();
  const blockMC = ds?.market_open === false;
  const blockD = grade === "D";
  return (
    <Panel
      title={<span style={{ color: T.acc }}>FIB CONFLUENCE</span>}
      right={
        <>
          <Chip tone={fc.enabled ? "buy" : "dim"}>{fc.enabled ? "ENABLED" : "DISABLED"}</Chip>
          <RoleBadge>{fc.mode ?? "—"}</RoleBadge>
          {blockMC && <Chip tone="sell">BLOCK · MARKET_CLOSED</Chip>}
          {blockD && <Chip tone="sell">BLOCK · FINAL_CONFLUENCE_TOO_LOW</Chip>}
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4">
        <KV label="Last Symbol" value={fc.last_symbol ?? "—"} tone="acc" />
        <KV label="Decision" value={dec || "—"} tone={dec === "BUY" ? "buy" : dec === "SELL" ? "sell" : "warn"} />
        <KV label="Score" value={fc.last_score ?? "—"} />
        <KV label="Grade" value={fc.last_grade ?? "—"} tone={grade === "A" || grade === "B" ? "buy" : grade === "D" ? "sell" : "warn"} />
        <KV label="RR" value={fc.last_rr ?? "—"} />
        <KV label="Golden Zone" value={fc.fib_zone ?? "—"} />
        <KV label="Swing High" value={fc.swing_high ?? "—"} />
        <KV label="Swing Low" value={fc.swing_low ?? "—"} />
        <KV label="Demo Eligible" value={fc.demo_eligible === true ? "TRUE" : fc.demo_eligible === false ? "FALSE" : "—"} tone={fc.demo_eligible ? "buy" : "warn"} />
        <div className="col-span-2 md:col-span-3"><KV label="Reason" value={fc.last_reason ?? "—"} /></div>
      </div>
    </Panel>
  );
}

function HermesPackPanel() {
  const ds: any = useDashboardStatusPayload();
  const hp = ds?.strategy_pack;
  if (!hp) return (
    <Panel title="HERMES STRATEGY PACK" right={<RoleBadge>WRAPPER</RoleBadge>}>
      <StatePanel state="NO_DATA" message="strategy_pack MISSING" />
    </Panel>
  );
  return (
    <Panel
      title={<span style={{ color: T.acc }}>HERMES STRATEGY PACK</span>}
      right={
        <>
          <Chip tone={hp.enabled ? "buy" : "dim"}>{hp.enabled ? "ENABLED" : "DISABLED"}</Chip>
          <RoleBadge>{hp.mode ?? "—"}</RoleBadge>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4">
        <KV label="Last Symbol" value={hp.last_symbol ?? "—"} tone="acc" />
        <KV label="Decision" value={hp.last_decision ?? "—"} tone={hp.last_decision === "WAIT" ? "warn" : "acc"} />
        <KV label="Best Internal" value={hp.last_internal ?? hp.best_internal ?? "—"} />
        <KV label="Rejected Internal" value={hp.rejected_internal_count ?? "—"} />
        <KV label="Score" value={hp.last_score ?? "—"} />
        <KV label="Confidence" value={hp.last_confidence ?? "—"} />
        <KV label="RR" value={hp.last_rr ?? "—"} />
        <KV label="Grade" value={hp.last_grade ?? "—"} />
        <KV label="Demo Eligible" value={hp.demo_eligible === true ? "TRUE" : hp.demo_eligible === false ? "FALSE" : "—"} tone={hp.demo_eligible ? "buy" : "warn"} />
        <div className="col-span-2 md:col-span-3"><KV label="Reason" value={hp.last_reason ?? "—"} /></div>
      </div>
    </Panel>
  );
}

function BalancedSelectorPanel() {
  const ds: any = useDashboardStatusPayload();
  const bs = ds?.balanced_selector;
  const re = ds?.risk_exposure ?? {};
  const best = ds?.best_candidate_now ?? ds?.setup_hunter?.best_candidate ?? null;
  if (!bs) return (
    <Panel title="BALANCED SELECTOR" right={<RoleBadge>PORTFOLIO ROUTER</RoleBadge>}>
      <StatePanel state="NO_DATA" message="balanced_selector MISSING" />
    </Panel>
  );
  const allowed: string[] = Array.isArray(bs.allowed_strategies) ? bs.allowed_strategies : [];
  return (
    <Panel
      title={<span style={{ color: T.acc }}>BALANCED SELECTOR</span>}
      right={<RoleBadge>PORTFOLIO ROUTER · READ-ONLY</RoleBadge>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4">
        <KV label="Max Total Open" value={bs.max_total_open_demo_trades ?? "—"} />
        <KV label="Max Per Symbol" value={bs.max_open_per_symbol ?? "—"} />
        <KV label="Demo Max Lot" value={bs.demo_max_lot ?? "—"} />
        <KV label="Magic" value={bs.demo_magic_number ?? "—"} />
        <KV label="Open Now" value={re.open_demo_trades ?? "—"} tone={Number(re.open_demo_trades) >= Number(bs.max_total_open_demo_trades) ? "warn" : "dim"} />
        <KV label="Floating PnL" value={re.demo_floating_pnl ?? "—"} tone={Number(re.demo_floating_pnl) > 0 ? "buy" : Number(re.demo_floating_pnl) < 0 ? "sell" : "dim"} />
        <KV label="No D-Grade Routing" value={bs.no_d_grade_routing ? "TRUE" : "FALSE"} tone={bs.no_d_grade_routing ? "buy" : "warn"} />
        <KV label="No Market-Closed Routing" value={bs.no_market_closed_routing ? "TRUE" : "FALSE"} tone={bs.no_market_closed_routing ? "buy" : "warn"} />
      </div>

      <div className="mt-2">
        <div className="text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: T.dim }}>Allowed Strategies</div>
        <div className="flex flex-wrap gap-1">
          {allowed.length === 0 ? <Chip tone="dim">NONE</Chip> : allowed.map((s) => <Chip key={s} tone="acc" outline>{s}</Chip>)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4" style={{ borderTop: `1px solid ${T.line}`, paddingTop: 8 }}>
        <KV label="Selector Best" value={best?.strategy ?? "—"} tone="acc" />
        <KV label="Best Symbol" value={best?.broker_symbol ?? best?.symbol ?? "—"} />
        <KV label="Best Score" value={best?.score ?? "—"} />
        <KV label="Best Grade" value={best?.grade ?? "—"} />
        <div className="col-span-2 md:col-span-4">
          <KV label="Diversification Reason" value={best?.near_miss_reason ?? ds?.relaxed_reason ?? ds?.last_demo_gate_reason ?? "—"} />
        </div>
      </div>
    </Panel>
  );
}
