import { Panel, KV, Chip, T, StatePanel, ageSecFrom, useTick, RoleBadge, DataStateBadge, fmtAge } from "../primitives";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

const SYMBOLS = ["BTCUSD#", "GOLD#", "EURUSD", "US100Cash#"] as const;

export function LiveMarketsTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {SYMBOLS.map((s) => <SymbolTile key={s} broker={s} />)}
    </div>
  );
}

function SymbolTile({ broker }: { broker: string }) {
  const ds: any = useDashboardStatusPayload();
  const tick = useTick(1000);

  const symbols = ds?.symbols ?? {};
  const node = symbols[broker] ?? symbols[broker.replace(/#$/, "")] ?? null;
  const gateMap = ds?.symbol_gate_status_by_symbol ?? {};
  const gate = gateMap[broker] ?? gateMap[broker.replace(/#$/, "")] ?? null;
  const tradeSyms: string[] = Array.isArray(ds?.hermes_trade_symbols) ? ds.hermes_trade_symbols : [];
  const allowed: string[] = Array.isArray(ds?.balanced_selector?.allowed_strategies) ? ds.balanced_selector.allowed_strategies : [];

  const inMainCycle = tradeSyms.includes(broker) || tradeSyms.includes(broker.replace(/#$/, ""));
  const enabled = gate?.decision === "PASS";
  const available = node != null;

  const marketOpen = ds?.market_open;
  const backendStaleFlag = !!ds?.backend_stale;
  const lastUpdate = node?.last_update_utc;
  const ageS = ageSecFrom(lastUpdate, tick);

  // Market closed → BLOCK / MARKET_CLOSED takes precedence over price freshness
  const marketClosed = marketOpen === false;
  const noData = !node;
  const stale = backendStaleFlag || (ageS != null && ageS > 120);
  const state = noData ? "NO_DATA" : marketClosed ? "DEGRADED" : stale ? "STALE" : "LIVE";

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span style={{ color: T.acc }}>{broker}</span>
          <RoleBadge>READ-ONLY</RoleBadge>
        </span>
      }
      right={<DataStateBadge state={state} ageSec={ageS} />}
    >
      {noData ? (
        <StatePanel state="NO_DATA" message="NO SYMBOL PAYLOAD" hint={`payload.symbols.${broker} absent`} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4" style={{ opacity: stale || marketClosed ? 0.7 : 1 }}>
          <KV label="Enabled" value={renderBool(enabled)} tone={enabled ? "buy" : "warn"} />
          <KV label="Available" value={renderBool(available)} tone={available ? "buy" : "warn"} />
          <KV label="In Main Cycle" value={renderBool(inMainCycle)} tone={inMainCycle ? "acc" : "dim"} />
          <KV label="Allowed Strategies" value={allowed.length || "—"} />

          <div className="col-span-2 mt-2 mb-1">
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>Last Price</div>
            <div
              className="text-[26px] tabular-nums font-bold"
              style={{
                color: stale || node?.price == null ? T.dim : T.txt,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {node?.price == null ? "—" : Number(node.price).toLocaleString(undefined, { maximumFractionDigits: 5 })}
            </div>
          </div>

          <KV label="Spread" value={node?.spread ?? "—"} />
          <KV
            label="Spread Status"
            value={node?.spread_status ?? "—"}
            tone={node?.spread_status === "PASS" ? "buy" : node?.spread_status === "FAIL" ? "sell" : "dim"}
          />
          <KV label="Session" value={node?.session ?? ds?.session_name ?? "—"} />
          <KV
            label="Time Gate"
            value={node?.time_gate ?? ds?.time_gate_status ?? "—"}
            tone={String(node?.time_gate ?? ds?.time_gate_status) === "PASS" ? "buy" : "warn"}
          />
          <KV
            label="Route Status"
            value={marketClosed ? "BLOCK" : (node?.route_status ?? "—")}
            tone={marketClosed ? "sell" : node?.route_status === "ROUTE_ALLOWED" ? "buy" : node?.route_status === "BLOCKED" ? "sell" : "warn"}
          />
          <KV label="Latest Decision" value={node?.latest_decision ?? "—"} />
          <KV label="Last Update" value={lastUpdate ? `${fmtAge(ageS)} ago` : "—"} />
          <div className="col-span-2 mt-1">
            <KV
              label="Latest Reason"
              value={
                marketClosed ? "MARKET_CLOSED" :
                (node?.latest_reason ?? (gate?.reason ?? "—"))
              }
              tone={marketClosed ? "sell" : "dim"}
            />
          </div>

          <div className="col-span-2 mt-2 flex flex-wrap gap-1">
            {marketClosed && <Chip tone="sell">BLOCK · MARKET_CLOSED</Chip>}
            {!marketClosed && node?.latest_reason && String(node.latest_reason).toUpperCase().includes("FINAL_CONFLUENCE_TOO_LOW") && (
              <Chip tone="sell">BLOCK · FINAL_CONFLUENCE_TOO_LOW</Chip>
            )}
            {stale && !marketClosed && <Chip tone="warn">BACKEND STALE</Chip>}
          </div>
        </div>
      )}
    </Panel>
  );
}

function renderBool(v: any) {
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  return "—";
}
