import { Panel, KV, Chip, T, FreshnessBadge, StatePanel, ageSecFrom, useTick, RoleBadge, DataStateBadge, fmtAge } from "../primitives";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useDualHealth } from "../health";

const FLOW_SYMBOLS = ["BTCUSD", "GOLD", "EURUSD", "US100Cash"] as const;
const BROKER: Record<string, string> = {
  BTCUSD: "BTCUSD#",
  GOLD: "GOLD#",
  EURUSD: "EURUSD",
  US100Cash: "US100Cash#",
};

export function OrderFlowTab() {
  const h = useDualHealth();
  const ds: any = useDashboardStatusPayload();
  const agent = ds?.order_flow_execution_agent ?? ds?.payload?.order_flow_execution_agent;

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <span style={{ color: T.acc }}>ORDER FLOW EXECUTION AGENT</span>
            <RoleBadge>ACTIVE EXECUTION STRATEGY</RoleBadge>
          </span>
        }
        right={
          <>
            <Chip tone="acc">DATA FEED ≠ EXECUTION AGENT</Chip>
            {h.backend !== "ONLINE" && <Chip tone="warn">HEARTBEAT {h.backend}</Chip>}
          </>
        }
      >
        {agent ? <AgentBlock agent={agent} stale={h.backend !== "ONLINE"} /> : <StatePanel state="NO_DATA" message="ORDER_FLOW_EXECUTION_AGENT NOT EMITTED" />}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {FLOW_SYMBOLS.map((s) => <FlowTile key={s} symbol={s} backendOnline={h.backend === "ONLINE"} />)}
      </div>
    </div>
  );
}

function AgentBlock({ agent, stale }: { agent: any; stale: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4" style={{ opacity: stale ? 0.55 : 1 }}>
      <KV label="Enabled" value={agent?.enabled ? "TRUE" : "FALSE"} tone={agent?.enabled ? "buy" : "dim"} />
      <KV label="Last Symbol" value={agent?.last_symbol ?? "—"} />
      <KV label="Last Setup" value={agent?.last_setup ?? "—"} />
      <KV label="Direction" value={agent?.last_direction ?? "—"} tone={String(agent?.last_direction).includes("BUY") ? "buy" : String(agent?.last_direction).includes("SELL") ? "sell" : undefined} />
      <KV label="Score" value={agent?.last_score ?? "—"} />
      <KV label="Grade" value={agent?.last_grade ?? "—"} tone="acc" />
      <KV label="Reason" value={agent?.last_reason ?? "—"} />
      <KV label="Route Decision" value={agent?.last_route_decision ?? "—"} />
      <KV label="Last Update" value={fmtAge(ageSecFrom(agent?.last_update))} />
      <KV label="Routes Via" value="BACKEND DEMO ROUTER" tone="acc" />
    </div>
  );
}

function FlowTile({ symbol, backendOnline }: { symbol: string; backendOnline: boolean }) {
  const ds: any = useDashboardStatusPayload();
  const tabs = ds?.order_flow?.tabs ?? ds?.payload?.order_flow?.tabs ?? {};
  const node = tabs[symbol] ?? tabs[BROKER[symbol]] ?? null;
  const tick = useTick(1000);

  // US100Cash is not emitted by backend
  if (symbol === "US100Cash" && !node) {
    return (
      <Panel
        title={<span style={{ color: T.acc }}>{BROKER[symbol]}</span>}
        right={<><RoleBadge>OBSERVE ONLY</RoleBadge><DataStateBadge state="NO_DATA" /></>}
      >
        <StatePanel state="NO_DATA" message="WAITING DATA" hint="ORDER_FLOW payload not emitted for US100Cash#" />
      </Panel>
    );
  }

  const status = String(node?.status ?? "").toUpperCase();
  const ageS = node?.age_seconds != null ? Number(node.age_seconds) : ageSecFrom(node?.last_update, tick);
  const stale = !node || status === "STALE" || (ageS != null && ageS > 60);
  const state = !node ? "NO_DATA" : stale ? "STALE" : "LIVE";

  return (
    <Panel
      title={<span style={{ color: T.acc }}>{BROKER[symbol] ?? symbol}</span>}
      right={
        <>
          <RoleBadge>OBSERVE ONLY</RoleBadge>
          <DataStateBadge state={state as any} ageSec={ageS} />
        </>
      }
    >
      {!node ? (
        <StatePanel state="NO_DATA" message="NO ORDER FLOW PAYLOAD" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4" style={{ opacity: stale ? 0.6 : 1 }}>
            <KV label="VWAP" value={fmt(node?.vwap)} />
            <KV label="POC" value={fmt(node?.poc)} />
            <KV label="VAH" value={fmt(node?.vah)} />
            <KV label="VAL" value={fmt(node?.val)} />
            <KV label="CVD Slope" value={fmt(node?.cvd_slope, 0)} tone={Number(node?.cvd_slope) > 0 ? "buy" : Number(node?.cvd_slope) < 0 ? "sell" : undefined} />
            <KV label="Delta" value={fmt(node?.delta_proxy, 0)} tone={Number(node?.delta_proxy) > 0 ? "buy" : Number(node?.delta_proxy) < 0 ? "sell" : undefined} />
            <KV label="Divergence" value={node?.divergence ?? "NO"} />
            <KV label="Buy Pressure" value={fmt(node?.buy_pressure, 0)} tone="buy" />
            <KV label="Sell Pressure" value={fmt(node?.sell_pressure, 0)} tone="sell" />
            <KV label="Confidence" value={node?.confidence != null ? `${node.confidence}%` : "—"} />
            <KV label="Mode" value={node?.mode ?? "—"} />
            <KV label="Age" value={fmtAge(ageS)} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Chip tone="dim" outline>DEPTH APPROX · tick-vol / CVD proxy (MT5 has no native L2)</Chip>
            {stale && !backendOnline && <Chip tone="warn">ORDER FLOW COMPUTED BY BACKEND · REMOTE SNAPSHOT STALE</Chip>}
          </div>
        </>
      )}
    </Panel>
  );
}

function fmt(v: any, digits = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
