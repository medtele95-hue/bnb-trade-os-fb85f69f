import { useEffect, useState } from "react";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { useTableHeartbeat } from "@/hooks/useTableHeartbeat";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";
import { Panel } from "@/components/dashboard/Panel";

function age(now: number, ms: number | null): string {
  if (!ms) return "—";
  return `${Math.max(0, Math.floor((now - ms) / 1000))}s`;
}

function tone(now: number, ms: number | null): string {
  if (!ms) return "opacity-60";
  const a = Math.floor((now - ms) / 1000);
  if (a > 60) return "text-loss";
  if (a > 15) return "text-orange-700";
  return "text-profit";
}

export function LiveSyncDebugPanel() {
  const rt = useRealtimeStatus();
  const ds = useDashboardStatusPayload();
  const tradesEv = useTableHeartbeat("trades");
  const snapEv = useTableHeartbeat("account_snapshots");
  const botEv = useTableHeartbeat("bot_status");
  const decEv = useTableHeartbeat("ai_decisions");
  const candleEv = useTableHeartbeat("market_candles");
  const logEv = useTableHeartbeat("bot_logs");
  const execEv = useTableHeartbeat("execution_events");

  const { rows: tradesAll } = useLiveTable<any>("trades", { limit: 500 });
  const demo = tradesAll.filter((t) => Number(t.magic_number ?? t.magic) === 909002);
  const openCount = demo.filter(
    (t) => String(t.result ?? "").toUpperCase() === "OPEN" && t.closed_at == null,
  ).length;
  const histCount = demo.filter(
    (t) => String(t.result ?? "").toUpperCase() === "CLOSED" || t.closed_at != null,
  ).length;

  const hb = ds.utc_time ?? ds.updated_at ?? ds.last_heartbeat ?? null;
  const hbDate = hb ? new Date(String(hb).replace(" ", "T")) : null;
  const hbMs = hbDate && !isNaN(hbDate.getTime()) ? hbDate.getTime() : null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  const rtTone =
    rt === "CONNECTED" ? "text-profit" : rt === "RECONNECTING" ? "text-orange-700" : "text-loss";
  const rtLabel =
    rt === "CONNECTED"
      ? "CONNECTED"
      : rt === "RECONNECTING"
        ? "RECONNECTING"
        : "OFFLINE — FALLBACK POLLING";

  const rows: Array<{ k: string; v: string; t?: string }> = [
    { k: "Realtime", v: rtLabel, t: rtTone },
    { k: "Backend heartbeat age", v: age(now, hbMs), t: tone(now, hbMs) },
    { k: "Last trades event", v: age(now, tradesEv), t: tone(now, tradesEv) },
    { k: "Last account_snapshots event", v: age(now, snapEv), t: tone(now, snapEv) },
    { k: "Last bot_status event", v: age(now, botEv), t: tone(now, botEv) },
    { k: "Last ai_decisions event", v: age(now, decEv), t: tone(now, decEv) },
    { k: "Last market_candles event", v: age(now, candleEv), t: tone(now, candleEv) },
    { k: "Last bot_logs event", v: age(now, logEv), t: tone(now, logEv) },
    { k: "Last execution_events event", v: age(now, execEv), t: tone(now, execEv) },
    { k: "Open Demo query count", v: String(openCount) },
    { k: "Historical Demo query count", v: String(histCount) },
  ];

  return (
    <Panel title="LIVE SYNC DEBUG" right="READ-ONLY">
      <table className="w-full text-[10px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className="border-b border-dashed border-black/30">
              <td className="py-1 pr-2 opacity-70 uppercase tracking-wider">{r.k}</td>
              <td className={`py-1 font-bold text-right ${r.t ?? ""}`}>{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 text-[9px] uppercase tracking-widest opacity-70">
        Realtime primary · fallback polling 30s · ages from browser clock vs last realtime event
      </div>
    </Panel>
  );
}
