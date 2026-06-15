import * as React from "react";
import { Panel, KV, Chip, T, StatePanel, RoleBadge, useTick, ageSecFrom, fmtAge } from "../primitives";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";
import { ChartPane } from "./ChartPane";

type TabId = "confirmations" | "plan" | "levels";

function normalizeSym(s: any): string {
  const x = String(s ?? "").toUpperCase();
  if (x === "BTCUSD") return "BTCUSD#";
  if (x === "XAUUSD" || x === "GOLD") return "GOLD#";
  return x;
}

export function SymbolCard({ broker }: { broker: string }) {
  const ds: any = useDashboardStatusPayload();
  const tick = useTick(1000);
  const [tab, setTab] = React.useState<TabId>("confirmations");

  const symbols = ds?.symbols ?? {};
  const node = symbols[broker] ?? symbols[broker.replace(/#$/, "")] ?? null;
  const gateMap = ds?.symbol_gate_status_by_symbol ?? {};
  const gate = gateMap[broker] ?? gateMap[broker.replace(/#$/, "")] ?? null;

  // Latest decision for this symbol (read-only)
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 100 });
  const decision = React.useMemo(() => {
    const target = normalizeSym(broker);
    const filtered = decisions.filter((d) => normalizeSym(d.symbol) === target);
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered[0] ?? null;
  }, [decisions, broker]);

  const observeOnly = /US100|NAS|NASDAQ/i.test(broker);
  const noData = !node;
  const ageS = ageSecFrom(node?.last_update_utc, tick);
  const stale = ds?.backend_stale === true || (ageS != null && ageS > 120);

  const reason = String(node?.latest_reason ?? gate?.reason ?? "").toUpperCase();
  const decisionStr = String(node?.latest_decision ?? "").toUpperCase();

  const state: "ACTIVE" | "WAIT" | "BLOCK" | "OBSERVE_ONLY" | "NO_DATA" | "STALE" =
    noData ? "NO_DATA" :
    stale ? "STALE" :
    observeOnly ? "OBSERVE_ONLY" :
    reason.includes("BLOCK") || node?.route_status === "BLOCKED" ? "BLOCK" :
    decisionStr === "WAIT" ? "WAIT" :
    decisionStr === "BUY" || decisionStr === "SELL" || node?.route_status === "ROUTE_ALLOWED" ? "ACTIVE" :
    "WAIT";

  // Build optional levels from decision payload — only when present, no fakes.
  const levels = decision
    ? {
        entry: decision.entry ?? null,
        sl: decision.sl ?? null,
        tp1: decision.tp1 ?? decision.tp ?? null,
        tp2: decision.tp2 ?? null,
        support: decision.support ?? node?.support ?? null,
        resistance: decision.resistance ?? node?.resistance ?? null,
        vwap: decision.vwap ?? node?.vwap ?? null,
        poc: decision.poc ?? node?.poc ?? null,
        vah: decision.vah ?? node?.vah ?? null,
        val: decision.val ?? node?.val ?? null,
        session_high: node?.session_high ?? null,
        session_low: node?.session_low ?? null,
      }
    : null;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span style={{ color: T.acc }}>{broker}</span>
          <RoleBadge>READ-ONLY</RoleBadge>
          {observeOnly && <Chip tone="warn">OBSERVE ONLY</Chip>}
        </span>
      }
      right={<StateBadge state={state} ageSec={ageS} />}
    >
      {noData ? (
        <StatePanel state="NO_DATA" message="NO SYMBOL PAYLOAD" hint={`payload.symbols.${broker} absent`} />
      ) : (
        <div className="flex flex-col gap-2">
          <HeaderStrip broker={broker} node={node} ds={ds} ageS={ageS} />

          <div
            style={{
              background: T.panel2,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: 4,
            }}
          >
            <ChartPane symbol={broker} levels={levels} />
          </div>

          <div className="flex items-center gap-1 mt-1" style={{ borderBottom: `1px solid ${T.line}` }}>
            {(["confirmations", "plan", "levels"] as TabId[]).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color: tab === id ? T.acc : T.dim,
                  borderBottom: tab === id ? `2px solid ${T.acc}` : "2px solid transparent",
                  fontWeight: tab === id ? 700 : 500,
                  background: "transparent",
                }}
              >
                {id}
              </button>
            ))}
          </div>

          {tab === "confirmations" && <ConfirmationsTab node={node} gate={gate} ds={ds} decision={decision} />}
          {tab === "plan" && <PlanTab decision={decision} observeOnly={observeOnly} />}
          {tab === "levels" && <LevelsTab levels={levels} node={node} />}
        </div>
      )}
    </Panel>
  );
}

/* -------- Sub-components -------- */

function StateBadge({ state, ageSec }: { state: string; ageSec: number | null }) {
  const tone: any =
    state === "ACTIVE" ? "buy" :
    state === "WAIT" ? "warn" :
    state === "BLOCK" ? "sell" :
    state === "OBSERVE_ONLY" ? "acc" :
    state === "STALE" ? "warn" :
    "danger";
  const label = state === "STALE" && ageSec != null ? `STALE · ${fmtAge(ageSec)}` : state;
  return <Chip tone={tone}>{label}</Chip>;
}

function HeaderStrip({ broker, node, ds, ageS }: { broker: string; node: any; ds: any; ageS: number | null }) {
  const price = node?.price;
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 px-2 py-2"
      style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6 }}
    >
      <div>
        <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>{broker}</div>
        <div
          className="text-[20px] tabular-nums font-bold"
          style={{
            color: price == null ? T.dim : T.txt,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {price == null ? "—" : Number(price).toLocaleString(undefined, { maximumFractionDigits: 5 })}
        </div>
      </div>
      <KV label="Spread" value={node?.spread ?? "—"} />
      <KV label="Session" value={node?.session ?? ds?.session_name ?? "—"} />
      <KV
        label="Time Gate"
        value={node?.time_gate ?? ds?.time_gate_status ?? "—"}
        tone={String(node?.time_gate ?? ds?.time_gate_status) === "PASS" ? "buy" : "warn"}
      />
      <KV label="Decision" value={node?.latest_decision ?? "—"} tone={node?.latest_decision === "BUY" ? "buy" : node?.latest_decision === "SELL" ? "sell" : "dim"} />
      <KV label="Last Update" value={ageS != null ? `${fmtAge(ageS)} ago` : "—"} />
      <div className="col-span-2 md:col-span-2">
        <KV label="Reason" value={node?.latest_reason ?? "—"} />
      </div>
    </div>
  );
}

function ConfirmationsTab({ node, gate, ds, decision }: { node: any; gate: any; ds: any; decision: any }) {
  const rows: Array<[string, any, any?]> = [
    ["SMC Score", decision?.smc_score],
    ["MTFA Score", decision?.mtfa_score],
    ["MTF Structure", decision?.mtf_structure_status ?? node?.mtf_structure_status],
    ["Top-Down", decision?.top_down_status ?? node?.top_down_status],
    ["Order Flow", decision?.order_flow_status ?? node?.order_flow_status],
    ["Confluence Score", decision?.confluence_score ?? decision?.score],
    ["Geometry / Breakout", decision?.geometry_score ?? decision?.breakout_score],
    ["Time Gate", node?.time_gate ?? ds?.time_gate_status, String(node?.time_gate ?? ds?.time_gate_status) === "PASS" ? "buy" : "warn"],
    ["Session", node?.session ?? ds?.session_name],
    ["Spread Status", node?.spread_status, node?.spread_status === "PASS" ? "buy" : node?.spread_status === "FAIL" ? "sell" : "dim"],
    ["Market State", ds?.market_state ?? node?.market_state],
    ["Route Status", node?.route_status ?? gate?.decision, node?.route_status === "ROUTE_ALLOWED" ? "buy" : node?.route_status === "BLOCKED" ? "sell" : "warn"],
    ["Latest Decision", node?.latest_decision],
    ["Latest Reason", node?.latest_reason ?? gate?.reason],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 mt-1">
      {rows.map(([k, v, tone]) => (
        <KV key={k} label={k} value={v ?? "—"} tone={tone as any} />
      ))}
    </div>
  );
}

function PlanTab({ decision, observeOnly }: { decision: any; observeOnly: boolean }) {
  if (!decision) {
    return <StatePanel state="NO_DATA" message="NO PLAN" hint="no decision in ai_decisions for this symbol" />;
  }
  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex flex-wrap gap-1 mb-1">
        <Chip tone="dim">ANALYSIS ONLY</Chip>
        {observeOnly && <Chip tone="warn">OBSERVE_ONLY · NO EXECUTION</Chip>}
        {decision.grade && <Chip tone={decision.grade === "A" || decision.grade === "B" ? "buy" : decision.grade === "D" ? "sell" : "warn"}>GRADE {decision.grade}</Chip>}
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <KV label="Direction" value={decision.direction ?? "—"} tone={decision.direction === "BUY" ? "buy" : decision.direction === "SELL" ? "sell" : "dim"} />
        <KV label="Bias" value={decision.bias ?? "—"} />
        <KV label="Entry" value={decision.entry ?? "—"} />
        <KV label="SL" value={decision.sl ?? "—"} tone="sell" />
        <KV label="TP1" value={decision.tp1 ?? decision.tp ?? "—"} tone="buy" />
        <KV label="TP2" value={decision.tp2 ?? "—"} tone="buy" />
        <KV label="RR" value={decision.rr ?? "—"} />
        <KV label="Confidence" value={decision.confidence ?? decision.score ?? "—"} />
        <KV label="Missing Confirmations" value={decision.missing_confirmations ?? decision.near_miss_reason ?? "—"} />
      </div>
    </div>
  );
}

function LevelsTab({ levels, node }: { levels: any; node: any }) {
  if (!levels) {
    return <StatePanel state="NO_DATA" message="NO LEVELS" hint="no decision payload to derive levels" />;
  }
  const keys: Array<[string, any]> = [
    ["Support", levels.support],
    ["Resistance", levels.resistance],
    ["Entry", levels.entry],
    ["SL", levels.sl],
    ["TP1", levels.tp1],
    ["TP2", levels.tp2],
    ["VWAP", levels.vwap],
    ["POC", levels.poc],
    ["VAH", levels.vah],
    ["VAL", levels.val],
    ["Session High", levels.session_high],
    ["Session Low", levels.session_low],
    ["Last Price", node?.price],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 mt-1">
      {keys.map(([k, v]) => (
        <KV key={k} label={k} value={v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 5 })} />
      ))}
    </div>
  );
}
