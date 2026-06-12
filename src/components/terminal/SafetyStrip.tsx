import { T } from "./primitives";

const FACTS = [
  "DEMO ONLY",
  "LIVE TRADING BLOCKED",
  "ALLOW_LIVE_TRADING=false",
  "DEMO_MAX_LOT=0.01",
  "MAGIC=909002",
  "DASHBOARD READ-ONLY",
  "EXECUTION ONLY FROM BACKEND DEMO ROUTER",
];

export function SafetyStrip() {
  const stripe = `repeating-linear-gradient(45deg, ${T.warn} 0 12px, #1a1305 12px 24px)`;
  return (
    <div
      className="w-full flex items-stretch"
      style={{ background: stripe, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}
    >
      <div
        className="flex-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] font-bold"
        style={{
          background: "rgba(4,6,12,0.86)",
          color: T.warn,
          fontFamily: "Archivo, sans-serif",
        }}
      >
        {FACTS.map((f) => (
          <span key={f} className="whitespace-nowrap">
            <span style={{ color: T.warn, marginRight: 6 }}>▲</span>
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
