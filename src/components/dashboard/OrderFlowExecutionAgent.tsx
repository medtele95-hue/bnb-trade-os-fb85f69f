import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge, statusTone, gradeTone } from "./Badges";
import { useDashboardStatusPayload } from "./DemoCenter";
import { useBackendHealth } from "@/hooks/useBackendHealth";

function ageLabel(iso: any): string {
  if (!iso) return "—";
  const t = Date.parse(String(iso).replace(" ", "T"));
  if (isNaN(t)) return String(iso);
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function readContainer(ds: any, key: string): any {
  return (
    ds?.[key] ??
    ds?.raw_payload?.[key] ??
    ds?.payload?.[key] ??
    {}
  );
}

export function OrderFlowExecutionAgentPanel() {
  const ds: any = useDashboardStatusPayload();
  const { verdict, ageSec } = useBackendHealth();
  const stale = verdict !== "ONLINE";

  const reader = readContainer(ds, "order_flow_reader");
  const agent = readContainer(ds, "order_flow_execution_agent");

  const enabled = Boolean(agent?.enabled);
  const agentStatus = enabled ? "ACTIVE_EXECUTION" : String(agent?.status ?? "INACTIVE").toUpperCase();
  const readerStatus = "OBSERVE ONLY";

  const lastSymbol = agent?.last_symbol ?? "—";
  const lastSetup = agent?.last_setup ?? "—";
  const lastDirection = String(agent?.last_direction ?? "—").toUpperCase();
  const lastScore = agent?.last_score ?? "—";
  const lastGrade = agent?.last_grade ?? "—";
  const lastReason = agent?.last_reason ?? "—";
  const lastRouteDecision = agent?.last_route_decision ?? "—";
  const lastUpdate = agent?.last_update ?? null;

  const dirTone =
    lastDirection === "BUY" || lastDirection === "LONG"
      ? "green"
      : lastDirection === "SELL" || lastDirection === "SHORT"
      ? "red"
      : "gray";

  const tradeReadyAllowed = !stale && enabled;

  return (
    <Panel
      title="ORDER FLOW EXECUTION AGENT"
      right={
        <div className="flex items-center gap-1 flex-wrap">
          <Badge value={`READER · ${readerStatus}`} tone="gray" />
          <Badge
            value={`AGENT · ${agentStatus}`}
            tone={enabled ? (stale ? "orange" : "green") : "gray"}
          />
          {stale && (
            <Badge value={`STALE · ${ageSec != null ? ageSec + "s" : "—"}`} tone="orange" />
          )}
          {tradeReadyAllowed && agent?.trade_ready && (
            <Badge value="TRADE READY" tone="strong-green" />
          )}
        </div>
      }
    >
      <div style={stale ? { opacity: 0.55 } : undefined} className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-6 space-y-0.5">
          <KV k="Enabled" v={
            <Badge value={enabled ? "TRUE" : "FALSE"} tone={enabled ? "green" : "gray"} />
          } />
          <KV k="Last Symbol" v={lastSymbol} />
          <KV k="Last Setup" v={lastSetup} />
          <KV k="Last Direction" v={<Badge value={lastDirection} tone={dirTone as any} />} />
          <KV k="Last Score" v={String(lastScore)} />
          <KV k="Last Grade" v={<Badge value={String(lastGrade)} tone={gradeTone(lastGrade)} />} />
        </div>
        <div className="col-span-12 md:col-span-6 space-y-0.5">
          <KV k="Last Reason" v={<span className="text-right">{String(lastReason)}</span>} />
          <KV
            k="Route Decision"
            v={<Badge value={String(lastRouteDecision)} tone={statusTone(lastRouteDecision)} />}
          />
          <KV k="Last Update" v={lastUpdate ? `${ageLabel(lastUpdate)} ago` : "—"} />
          <KV k="Reader Last Update" v={reader?.last_update ? `${ageLabel(reader.last_update)} ago` : "—"} />
        </div>

        <div className="col-span-12 mt-2 flex flex-wrap gap-1">
          <Badge value="Routes only through backend DemoRouter" tone="gray" />
          <Badge value="Dashboard read-only · Live blocked · Max lot 0.01" tone="orange" />
          {stale && (
            <Badge value="HEARTBEAT STALE — TRADE READY SUPPRESSED" tone="orange" />
          )}
        </div>
      </div>
    </Panel>
  );
}
