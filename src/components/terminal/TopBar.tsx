import { T, useTick, Chip } from "./primitives";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

export function TopBar() {
  const ds: any = useDashboardStatusPayload();
  const t = useTick(1000);
  const d = t ? new Date(t) : null;
  const utc = d ? d.toISOString().slice(11, 19) : "--:--:--";
  const cas = d
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Casablanca",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d)
    : "--:--:--";

  const mode = String(ds?.mode ?? "DEMO_PILOT_48H").replace(/_/g, " ");
  const account = String(ds?.account_type ?? "DEMO").toUpperCase();

  return (
    <header
      className="w-full px-4 py-2 flex items-center justify-between gap-4"
      style={{
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        fontFamily: "Archivo, sans-serif",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="text-[15px] font-extrabold tracking-[0.32em]"
          style={{ color: T.acc, textShadow: `0 0 18px ${T.acc}40` }}
        >
          HERMES
        </div>
        <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: T.dim }}>
          Trading Terminal
        </span>
      </div>

      <div className="hidden md:flex items-center gap-2">
        <Chip tone="acc">{account} · {mode}</Chip>
        <Chip tone="dim" outline>READ-ONLY MONITOR</Chip>
      </div>

      <div className="flex items-center gap-3 text-[10.5px] tabular-nums" style={{ color: T.txt, fontFamily: "JetBrains Mono, monospace" }}>
        <span><span style={{ color: T.dim }}>UTC</span> {utc}</span>
        <span style={{ color: T.faint }}>·</span>
        <span><span style={{ color: T.dim }}>CAS</span> {cas}</span>
      </div>
    </header>
  );
}
