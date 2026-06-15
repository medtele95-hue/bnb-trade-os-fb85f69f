import { useEffect, useState } from "react";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { useLiveTable } from "@/hooks/useLiveTable";

export type HealthVerdict = "ONLINE" | "STALE_DEGRADED" | "OFFLINE";

function parseAge(iso: any, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(String(iso).replace(" ", "T"));
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 1000));
}

export function useBackendHealth() {
  const ds: any = useDashboardStatusPayload();
  const rt = useRealtimeStatus();
  const tradesLive = useLiveTable<any>("trades", { limit: 1 });
  const decisionsLive = useLiveTable<any>("ai_decisions", { limit: 1 });
  const trades = tradesLive.rows;
  const decisions = decisionsLive.rows;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  const hb =
    ds?.backend_utc_time ??
    ds?.utc_time ??
    ds?.updated_at ??
    ds?.last_heartbeat ??
    null;
  const ageSec = parseAge(hb, now);
  const tradesAge = parseAge(trades[0]?.opened_at ?? trades[0]?.created_at, now);
  const decisionsAge = parseAge(decisions[0]?.created_at, now);

  const channelConnected = rt === "CONNECTED";
  // Channel-level "alive" — recent trade activity OR channel connected.
  const channelAlive = channelConnected || (tradesAge != null && tradesAge < 60);
  const hasDashboardHeartbeat = ageSec != null;
  const readReachable =
    (!tradesLive.loading && !tradesLive.error) ||
    (!decisionsLive.loading && !decisionsLive.error) ||
    hasDashboardHeartbeat;

  const stale = ageSec != null && ageSec > 60;
  const degraded = (ageSec != null && ageSec > 15) || rt === "RECONNECTING";

  // OFFLINE only when every backend signal is unavailable.
  // If REST reads are succeeding but realtime/heartbeat is lagging, this is STALE_DEGRADED, not OFFLINE.
  const offline =
    !channelAlive &&
    !readReachable &&
    (rt === "OFFLINE" || !hasDashboardHeartbeat);

  const verdict: HealthVerdict = offline ? "OFFLINE" : stale || degraded ? "STALE_DEGRADED" : "ONLINE";
  const tradeReady = verdict === "ONLINE";

  return {
    ageSec, hb, rt, stale, degraded, offline, tradeReady,
    verdict, tradesAge, decisionsAge,
  };
}
