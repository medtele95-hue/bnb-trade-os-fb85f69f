import { Panel, KV, Chip, T, FreshnessBadge, StatePanel, ageSecFrom, useTick, RoleBadge, DataStateBadge } from "../primitives";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

const SYMBOLS = ["BTCUSD", "GOLD", "EURUSD", "US100Cash"] as const;
const BROKER: Record<string, string> = {
  BTCUSD: "BTCUSD#",
  GOLD: "GOLD#",
  EURUSD: "EURUSD",
  US100Cash: "US100Cash#",
};

export function LiveMarketsTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {SYMBOLS.map((s) => <SymbolTile key={s} symbol={s} />)}
    </div>
  );
}

function SymbolTile({ symbol }: { symbol: string }) {
  const ds: any = useDashboardStatusPayload();
  const tabs = ds?.order_flow?.tabs ?? ds?.payload?.order_flow?.tabs ?? {};
  const node = tabs[symbol] ?? tabs[BROKER[symbol]] ?? {};
  const spreadNode = ds?.spread?.[BROKER[symbol]] ?? ds?.spread?.[symbol] ?? ds?.spread_diag?.[BROKER[symbol]] ?? ds?.spread_diag?.[symbol];
  const sessionNode = ds?.time_gate ?? ds?.session;
  const trend = ds?.trend?.[BROKER[symbol]] ?? ds?.trend?.[symbol] ?? node?.signal;
  const tick = useTick(1000);

  const price = node?.price ?? node?.chart_series?.price;
  const status = String(node?.status ?? "").toUpperCase();
  const ageS = node?.age_seconds != null ? Number(node.age_seconds) : ageSecFrom(node?.last_update, tick);
  const stale = status === "STALE" || (ageS != null && ageS > 60);
  const noData = !node || Object.keys(node).length === 0;

  const state = noData ? "NO_DATA" : stale ? "STALE" : "LIVE";

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span style={{ color: T.acc }}>{BROKER[symbol] ?? symbol}</span>
          <RoleBadge>OBSERVE ONLY</RoleBadge>
        </span>
      }
      right={<DataStateBadge state={state} ageSec={ageS} />}
    >
      {noData ? (
        <StatePanel state="NO_DATA" message="NO ORDER FLOW PAYLOAD FOR SYMBOL" hint="dashboard_status.order_flow.tabs absent for this symbol" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4" style={{ opacity: stale ? 0.55 : 1 }}>
          <div className="col-span-2 mb-2">
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>Last Price</div>
            <div
              className="text-[26px] tabular-nums font-bold"
              style={{
                color: stale ? T.dim : T.txt,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {stale || price == null ? "—" : Number(price).toLocaleString(undefined, { maximumFractionDigits: 5 })}
            </div>
          </div>
          <KV label="Signal" value={node?.signal ?? "—"} tone={String(node?.signal) === "BUY" ? "buy" : String(node?.signal) === "SELL" ? "sell" : "dim"} />
          <KV label="Confidence" value={node?.confidence != null ? `${node.confidence}%` : "—"} />
          <KV label="VWAP" value={fmt(node?.vwap)} />
          <KV label="POC" value={fmt(node?.poc)} />
          <KV label="VAH" value={fmt(node?.vah)} />
          <KV label="VAL" value={fmt(node?.val)} />
          <KV label="Spread" value={spreadNode?.spread ?? spreadNode?.value ?? "—"} />
          <KV label="Session" value={sessionNode?.session ?? "—"} />
          <KV label="Time Gate" value={sessionNode?.decision ?? "—"} tone={sessionNode?.decision === "PASS" ? "buy" : "warn"} />
          <KV label="Bias" value={trend ?? "—"} />
        </div>
      )}
    </Panel>
  );
}

function fmt(v: any): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}
