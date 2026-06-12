import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useTick, ageSecFrom } from "./primitives";

export type BackendState = "ONLINE" | "STALE" | "OFFLINE";
export type IngestState = "LIVE" | "DEGRADED" | "CIRCUIT_BREAKER";

/**
 * Dual health: backend (heartbeat + cycle + channel) vs ingest (Lovable ingest pipe).
 * Both are computed from real fields; never hardcoded; never contradictory.
 */
export function useDualHealth() {
  const h = useBackendHealth();
  const ds: any = useDashboardStatusPayload();
  const rt = useRealtimeStatus();
  const now = useTick(1000);

  // backend: ONLINE | STALE | OFFLINE
  const backend: BackendState =
    h.verdict === "ONLINE" ? "ONLINE" :
    h.verdict === "OFFLINE" ? "OFFLINE" : "STALE";

  // ingest: derived from dashboard_status.lovable_ingest_health (or top-level)
  const ingestRaw =
    ds?.lovable_ingest_health ??
    ds?.ingest_health ??
    ds?.ingest_status ??
    null;
  const ingestStatus = String(ingestRaw?.status ?? ingestRaw ?? "").toUpperCase();
  const ingestReason = String(ingestRaw?.reason ?? "").toUpperCase();
  let ingest: IngestState =
    ingestStatus.includes("DEGRADED") ? "DEGRADED" :
    ingestStatus.includes("CIRCUIT") || ingestReason.includes("CIRCUIT_BREAKER") ? "CIRCUIT_BREAKER" :
    "LIVE";

  // If ingest field absent but backend is OFFLINE, do NOT claim DEGRADED — leave LIVE-by-default.
  // If channel is OFFLINE, mark ingest DEGRADED.
  if (rt === "OFFLINE" && ingest === "LIVE") ingest = "DEGRADED";

  const hbAge = h.ageSec;
  const cycleStatus = String(ds?.cycle_status ?? ds?.last_cycle?.status ?? "").toUpperCase();

  return {
    backend,
    ingest,
    hbAge,
    tradesAge: h.tradesAge,
    decisionsAge: h.decisionsAge,
    rt,
    cycleStatus,
    raw: h,
    now,
  };
}

export function useLatestSnapshot() {
  const { rows } = useLiveTable<any>("account_snapshots", {
    orderBy: "snapshot_time",
    ascending: false,
    limit: 1,
  });
  return rows[0] ?? null;
}
