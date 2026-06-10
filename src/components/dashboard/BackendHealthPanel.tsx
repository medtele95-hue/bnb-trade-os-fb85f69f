import { useEffect, useState } from "react";
import { Panel, KV } from "@/components/dashboard/Panel";
import { Badge } from "@/components/dashboard/Badges";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useBackendHealth } from "@/hooks/useBackendHealth";

function ageSec(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(String(iso).replace(" ", "T"));
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 1000));
}

function ageTone(s: number | null) {
  if (s == null) return "opacity-60";
  if (s > 60) return "text-loss";
  if (s > 15) return "text-orange-700";
  return "text-profit";
}

export function BackendHealthPanel() {
  const ds = useDashboardStatusPayload() as any;
  const h = useBackendHealth();
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 1 });
  const { rows: botStatus } = useLiveTable<any>("bot_status", { orderBy: "component", ascending: true, limit: 20 });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  const hb = ds.utc_time ?? ds.updated_at ?? ds.last_heartbeat ?? null;
  const hbAge = h.ageSec;
  const dsAge = ageSec(ds.updated_at ?? ds.utc_time, now);
  const decAge = ageSec(decisions[0]?.created_at, now);
  const ofAge = ageSec(
    ds.order_flow_reader?.last_update ??
    ds.raw_payload?.order_flow_reader?.last_update ??
    ds.order_flow_snapshot_at,
    now,
  );
  const trAge = ageSec(trades[0]?.opened_at ?? trades[0]?.created_at, now);

  const verdictLabel = h.verdict === "ONLINE" ? "ONLINE" : h.verdict === "OFFLINE" ? "OFFLINE" : "STALE · DEGRADED";
  const verdictTone = h.verdict === "ONLINE" ? "green" : h.verdict === "OFFLINE" ? "red" : "orange";
  const ingestLabel = h.verdict === "ONLINE" ? "OK" : h.verdict === "OFFLINE" ? "DOWN" : "DEGRADED";

  const byKey: Record<string, any> = {};
  botStatus.forEach((s: any) => (byKey[s.component] = s));
  const rdp = byKey["RDP"]?.status ?? "—";
  const backend = byKey["HERMES"]?.status ?? (botStatus.length ? "ONLINE" : "WAITING");

  return (
    <Panel
      title="BACKEND HEALTH / INGEST"
      right={
        <span className="flex items-center gap-2">
          <Badge value={`VERDICT: ${verdictLabel}`} tone={verdictTone as any} />
          <Badge value={`INGEST: ${ingestLabel}`} tone={verdictTone as any} />
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
        <KV k="Backend Heartbeat (HB AGE)" v={<span className={ageTone(hbAge)}>{hbAge == null ? "—" : `${hbAge}s ago`}</span>} />
        <KV k="dashboard_status" v={<span className={ageTone(dsAge)}>{dsAge == null ? "—" : `${dsAge}s ago`}</span>} />
        <KV k="ai_decisions" v={<span className={ageTone(decAge)}>{decAge == null ? "—" : `${decAge}s ago`}</span>} />
        <KV k="order_flow_snapshot" v={<span className={ageTone(ofAge)}>{ofAge == null ? "—" : `${ofAge}s ago`}</span>} />
        <KV k="trades" v={<span className={ageTone(trAge)}>{trAge == null ? "—" : `${trAge}s ago`}</span>} />
        <KV k="Supabase Channel" v={<b className={h.rt === "CONNECTED" ? "text-profit" : "text-loss"}>{h.rt}</b>} />
        <KV k="RDP" v={rdp} />
        <KV k="HERMES Backend" v={backend} />
        <KV k="Heartbeat Time" v={hb ? String(hb).slice(11, 19) : "—"} />
      </div>

      {h.verdict === "OFFLINE" && (
        <div className="mt-2 border-2 border-red-700 bg-red-100 text-red-900 px-2 py-1 text-[10px] uppercase tracking-widest">
          BACKEND OFFLINE — channel down and no recent activity · "trade ready" suppressed · dashboard remains read-only.
        </div>
      )}
      {h.verdict === "STALE_DEGRADED" && (
        <div className="mt-2 border border-orange-700 bg-orange-50 text-orange-900 px-2 py-1 text-[10px] uppercase tracking-widest">
          BACKEND STALE · DEGRADED — channel may be CONNECTED but heartbeat is lagging. Trade-ready suppressed; data may be old.
        </div>
      )}
    </Panel>
  );
}
