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
