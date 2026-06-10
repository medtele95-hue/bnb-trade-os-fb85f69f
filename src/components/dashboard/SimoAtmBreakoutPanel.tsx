import { Panel, KV } from "@/components/dashboard/Panel";
import { Badge } from "@/components/dashboard/Badges";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

const REQUESTED = ["US100", "NAS100", "USTEC", "US100Cash#", "NASDAQ"];

export function SimoAtmBreakoutPanel() {
  const ds = useDashboardStatusPayload() as any;
  const raw =
    ds?.simo_atm_breakout ??
    ds?.SIMO_ATM_BREAKOUT ??
    ds?.raw_payload?.simo_atm_breakout ??
    null;

  return (
    <Panel
      title="SIMO_ATM_BREAKOUT — Indices / Nasdaq"
      right={
        <span className="flex gap-1">
          <Badge value="ACTIVE_EXECUTION" tone="green" />
          <Badge value="ROUTE: YES" tone="green" />
        </span>
      }
    >
      <div className="mb-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
        <Badge value="DEMO ROUTER ONLY · LIVE TRADING BLOCKED" tone="orange" />
        <span className="opacity-70">SIMO_ATM_BREAKOUT can execute only through DEMO Router. Live trading is blocked.</span>
      </div>

      {!raw ? (
        <div className="border border-dashed border-black/40 p-3 text-[11px] italic opacity-80">
          Waiting for SIMO_ATM_BREAKOUT backend payload
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4">
            <KV k="Mode" v={String(raw.mode ?? "ACTIVE_EXECUTION").toUpperCase()} />
            <KV k="Route Allowed" v={raw.route_allowed === false ? "NO" : "YES"} />
            <KV k="Enabled" v={raw.enabled === false ? "OFF" : "ON"} />
            <KV k="Status" v={String(raw.status ?? "—").toUpperCase()} />
            <KV k="Direction" v={String(raw.direction ?? raw.signal ?? "—").toUpperCase()} />
            <KV k="Confidence" v={raw.confidence != null ? `${raw.confidence}%` : "—"} />
            <KV k="Entry" v={raw.entry ?? "—"} />
            <KV k="SL" v={raw.sl ?? "—"} accent="loss" />
            <KV k="TP" v={raw.tp ?? "—"} accent="profit" />
            <KV k="RR" v={raw.rr ?? raw.reward_risk ?? "—"} />
            <KV k="Spread" v={raw.spread ?? "—"} />
            <KV k="Session" v={raw.session ?? "—"} />
            <KV k="Pending Order" v={String(raw.pending_order_status ?? raw.pending_order ?? "—").toUpperCase()} />
            <KV k="Expiry" v={raw.expiry_time ?? raw.expiry ?? "—"} />
          </div>

          <div className="mt-2 border-t border-black pt-1.5">
            <div className="text-[10px] uppercase opacity-70">Requested Symbols</div>
            <div className="text-[11px] mt-0.5">{REQUESTED.join(" · ")}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-4">
              <KV k="Resolved Broker Symbol" v={raw.resolved_symbol ?? raw.broker_symbol ?? "—"} />
              <KV k="Discovery Status" v={String(raw.symbol_discovery_status ?? raw.discovery_status ?? "—").toUpperCase()} />
            </div>
            {!raw.resolved_symbol && !raw.broker_symbol && (
              <div className="mt-2 border border-dashed border-orange-700 text-orange-700 px-2 py-1 text-[10px] uppercase tracking-widest">
                Waiting for supported Nasdaq/US100 broker symbol.
              </div>
            )}
          </div>

          <div className="mt-2 border-t border-black pt-1.5 text-[10px]">
            <div className="opacity-70 uppercase">Last Reason</div>
            <div className="italic mt-0.5">{raw.last_reason ?? raw.reason ?? "—"}</div>
            <div className="opacity-70 uppercase mt-1">
              {raw.stale ? <Badge value="STALE" tone="orange" /> : <Badge value="FRESH" tone="green" />}
              <span className="ml-2 opacity-70">Last Update: <b>{raw.last_update ?? "—"}</b></span>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
