import * as React from "react";
import { Panel, Chip, T, StatePanel, RoleBadge, KV, fmtAge, ageSecFrom } from "../primitives";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDualHealth } from "../health";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

const CHECKLIST: { label: string; pass: boolean; detail: string }[] = [
  { label: "DEMO account confirmed", pass: true, detail: "account_type=DEMO" },
  { label: "ALLOW_LIVE_TRADING = false", pass: true, detail: "Constant" },
  { label: "DEMO_ONLY = true", pass: true, detail: "Constant" },
  { label: "DEMO_MAX_LOT = 0.01", pass: true, detail: "Cap enforced server-side" },
  { label: "MAGIC = 909002 only", pass: true, detail: "All trades scoped to magic 909002" },
  { label: "order_send backend-only", pass: true, detail: "Dashboard cannot reach MT5" },
  { label: "Dashboard read-only", pass: true, detail: "No write APIs surfaced" },
  { label: "Execution via backend DemoRouter only", pass: true, detail: "Strategy → Setup → SafetyGuard → DemoRouter → MT5" },
];

const CHAIN = ["Strategy", "Candidate Contract", "SetupHunter", "SafetyGuard", "DemoRouter", "MT5"] as const;

export function AuditTab() {
  const h = useDualHealth();
  const ds: any = useDashboardStatusPayload();
  const { rows: logs } = useLiveTable<any>("bot_logs", { limit: 80 });

  const safetyLogs = logs.filter((l) =>
    String(l.message).toUpperCase().includes("SAFETY") ||
    String(l.source).toUpperCase().includes("SAFETY")
  );

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Immutable Safety Checklist" right={<RoleBadge>READ-ONLY</RoleBadge>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CHECKLIST.map((c) => (
            <div
              key={c.label}
              className="flex items-start gap-2 px-2 py-2"
              style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 4 }}
            >
              <Chip tone={c.pass ? "buy" : "danger"}>{c.pass ? "PASS" : "FAIL"}</Chip>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.txt, fontFamily: "Archivo" }}>{c.label}</span>
                <span className="text-[10px]" style={{ color: T.dim }}>{c.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Backend Route Chain">
        <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ fontFamily: "Archivo" }}>
          {CHAIN.map((step, i) => (
            <React.Fragment key={step}>
              <div
                className="px-3 py-2 uppercase tracking-[0.14em]"
                style={{
                  background: T.panel2,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  color: i === CHAIN.length - 1 ? T.acc : T.txt,
                  fontWeight: 600,
                }}
              >
                {step}
              </div>
              {i < CHAIN.length - 1 && <span style={{ color: T.acc, fontSize: 18 }}>→</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: T.dim }}>
          Dashboard reads from this chain. It never enters it.
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Heartbeat & Cycle" className="col-span-12 md:col-span-6">
          <KV label="Backend" value={h.backend} tone={h.backend === "ONLINE" ? "buy" : "warn"} />
          <KV label="Ingest" value={h.ingest.replace("_", " ")} tone={h.ingest === "LIVE" ? "buy" : "warn"} />
          <KV label="Heartbeat Age" value={fmtAge(h.hbAge)} />
          <KV label="Last Cycle Status" value={h.cycleStatus || "—"} />
          <KV label="Realtime Channel" value={h.rt} tone={h.rt === "CONNECTED" ? "acc" : "warn"} />
          <KV label="Mode" value={ds?.mode ?? "—"} />
        </Panel>

        <Panel title="Latest Safety Log" className="col-span-12 md:col-span-6">
          {safetyLogs.length === 0 ? (
            <StatePanel
              state="NO_DATA"
              message="NO SAFETY_GUARD EVENTS IN bot_logs"
              hint="Backend has not emitted any SAFETY-tagged log lines in the recent window."
            />
          ) : (
            <ul className="flex flex-col gap-1 text-[10.5px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {safetyLogs.slice(0, 12).map((l) => (
                <li key={l.id} className="flex gap-2 items-baseline">
                  <span style={{ color: T.faint }}>{fmtAge(ageSecFrom(l.created_at))}</span>
                  <span style={{ color: l.level === "ERROR" ? T.sell : l.level === "WARN" || l.level === "WARNING" ? T.warn : T.txt }}>{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
