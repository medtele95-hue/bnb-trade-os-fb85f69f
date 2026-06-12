import { Chip, T, fmtAge } from "./primitives";
import { useDualHealth } from "./health";

export function BackendHealthBar() {
  const h = useDualHealth();

  const beTone =
    h.backend === "ONLINE" ? "buy" :
    h.backend === "STALE" ? "warn" : "danger";
  const beLabel = h.backend === "ONLINE" ? "BACKEND ONLINE" : h.backend === "STALE" ? "BACKEND STALE" : "BACKEND OFFLINE";

  const ingTone =
    h.ingest === "LIVE" ? "buy" :
    h.ingest === "DEGRADED" ? "warn" : "danger";
  const ingLabel =
    h.ingest === "LIVE" ? "INGEST LIVE" :
    h.ingest === "DEGRADED" ? "INGEST DEGRADED" : "INGEST CIRCUIT-BREAKER";

  const channelTone = h.rt === "CONNECTED" ? "acc" : h.rt === "RECONNECTING" ? "warn" : "danger";

  return (
    <div
      className="w-full px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.16em]"
      style={{
        background: T.head,
        borderBottom: `1px solid ${T.border}`,
        color: T.dim,
        fontFamily: "Archivo, sans-serif",
      }}
    >
      <Chip tone={beTone as any}>{beLabel}</Chip>
      <span className="tabular-nums" style={{ fontFamily: "JetBrains Mono, monospace" }}>
        HB AGE {fmtAge(h.hbAge)}
      </span>
      <span style={{ color: T.faint }}>·</span>
      <Chip tone={ingTone as any}>{ingLabel}</Chip>
      <span style={{ color: T.faint }}>·</span>
      <Chip tone={channelTone as any}>CHANNEL {h.rt}</Chip>
      {h.cycleStatus && (
        <>
          <span style={{ color: T.faint }}>·</span>
          <span className="tabular-nums" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            CYCLE {h.cycleStatus}
          </span>
        </>
      )}
      <span style={{ color: T.faint }}>·</span>
      <span>TRADES AGE {fmtAge(h.tradesAge)}</span>
      <span style={{ color: T.faint }}>·</span>
      <span>AI AGE {fmtAge(h.decisionsAge)}</span>
    </div>
  );
}
