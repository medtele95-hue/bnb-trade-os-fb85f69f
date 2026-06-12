import * as React from "react";
import { Panel, Chip, T, StatePanel, fmtAge, ageSecFrom } from "../primitives";
import { useLiveTable } from "@/hooks/useLiveTable";

const FILTERS = [
  { id: "ALL", label: "ALL", match: () => true },
  { id: "CANDIDATE", label: "CANDIDATE", match: (m: string) => m.includes("CANDIDATE") },
  { id: "SETUP_HUNTER", label: "SETUP HUNTER", match: (m: string) => m.includes("SETUP_HUNTER") || m.includes("SETUP HUNTER") },
  { id: "CONFIRMATION", label: "CONFIRMATION", match: (m: string) => m.includes("CONFIRMATION") },
  { id: "ORDER_FLOW", label: "ORDER FLOW", match: (m: string) => m.includes("ORDER_FLOW") || m.includes("ORDER FLOW") },
  { id: "SAFETY_GUARD", label: "SAFETY", match: (m: string) => m.includes("SAFETY") },
  { id: "DEMO_ORDER", label: "DEMO ORDER", match: (m: string) => m.includes("DEMO_ORDER") || m.includes("DEMO ORDER") || m.includes("ORDER_CONFIRMED") },
  { id: "ERROR", label: "ERROR", match: (m: string, l: string) => l === "ERROR" || m.includes("ERROR") || m.includes("FAIL") },
  { id: "WARNING", label: "WARNING", match: (m: string, l: string) => l === "WARN" || l === "WARNING" || m.includes("WARN") },
] as const;

type FilterId = typeof FILTERS[number]["id"];

export function LogsTab() {
  const { rows } = useLiveTable<any>("bot_logs", { limit: 300 });
  const [active, setActive] = React.useState<FilterId>("ALL");
  const [q, setQ] = React.useState("");

  const filtered = rows.filter((r) => {
    const msg = String(r.message ?? "").toUpperCase();
    const lvl = String(r.level ?? "").toUpperCase();
    const flt = FILTERS.find((f) => f.id === active)!;
    if (!flt.match(msg, lvl)) return false;
    if (q && !msg.includes(q.toUpperCase()) && !String(r.source ?? "").toUpperCase().includes(q.toUpperCase())) return false;
    return true;
  });

  const copy = (line: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(line);
  };

  return (
    <Panel
      title={`bot_logs · ${filtered.length} / ${rows.length}`}
      right={
        <>
          <input
            placeholder="search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-2 py-1 text-[10.5px] outline-none"
            style={{
              background: T.panel2,
              border: `1px solid ${T.border}`,
              color: T.txt,
              fontFamily: "JetBrains Mono, monospace",
              borderRadius: 3,
              width: 160,
            }}
          />
          <Chip tone="dim" outline>{rows.length === 0 ? "NO LOGS" : "LIVE"}</Chip>
        </>
      }
    >
      <div className="flex flex-wrap gap-1 mb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActive(f.id)}
            className="px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
            style={{
              background: active === f.id ? T.acc : "transparent",
              color: active === f.id ? "#04060c" : T.dim,
              border: `1px solid ${active === f.id ? T.acc : T.border}`,
              borderRadius: 3,
              fontFamily: "Archivo",
              fontWeight: active === f.id ? 700 : 500,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <StatePanel state="NO_DATA" message="bot_logs IS EMPTY" />
      ) : filtered.length === 0 ? (
        <StatePanel state="DEGRADED" message="NO LOGS MATCH CURRENT FILTER" hint="Try ALL or clear the search term." />
      ) : (
        <ul className="flex flex-col text-[10.5px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {filtered.map((r) => {
            const lvl = String(r.level ?? "INFO").toUpperCase();
            const color =
              lvl === "ERROR" ? T.sell :
              lvl === "WARN" || lvl === "WARNING" ? T.warn :
              lvl === "SUCCESS" ? T.buy :
              T.txt;
            const line = `[${r.created_at}] [${lvl}] [${r.source ?? "-"}] ${r.message}`;
            return (
              <li
                key={r.id}
                className="flex gap-2 items-baseline px-1 py-1 group"
                style={{ borderBottom: `1px solid ${T.line}` }}
              >
                <span style={{ color: T.faint, minWidth: 60 }}>{fmtAge(ageSecFrom(r.created_at))}</span>
                <span
                  className="px-1.5 text-[9px] uppercase tracking-[0.14em]"
                  style={{ background: color + "22", color, borderRadius: 2, minWidth: 50, textAlign: "center" }}
                >
                  {lvl}
                </span>
                <span style={{ color: T.dim, minWidth: 110 }}>{r.source ?? "-"}</span>
                <span className="flex-1" style={{ color }}>{r.message}</span>
                <button
                  onClick={() => copy(line)}
                  className="opacity-0 group-hover:opacity-100 px-1.5 text-[9px]"
                  style={{ color: T.dim, border: `1px solid ${T.border}`, borderRadius: 2, fontFamily: "Archivo" }}
                  title="Copy log line"
                >
                  COPY
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
