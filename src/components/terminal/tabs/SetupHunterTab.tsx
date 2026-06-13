import * as React from "react";
import { Panel, KV, Chip, T, StatePanel, RoleBadge, DataStateBadge, fmtAge, ageSecFrom } from "../primitives";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDualHealth } from "../health";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

const SYMBOLS = ["BTCUSD#", "GOLD#", "EURUSD", "US100Cash#"] as const;

function normalizeSymbol(s: any): string {
  const x = String(s ?? "").toUpperCase();
  if (x === "BTCUSD") return "BTCUSD#";
  if (x === "XAUUSD" || x === "GOLD") return "GOLD#";
  return x || "—";
}

type Stage = "WAITING" | "PASS" | "FAIL" | "BLOCKED" | "ROUTED";

const STAGES = [
  "Raw Signal",
  "Candidate Validation",
  "Confirmation Matrix",
  "SetupHunter",
  "SafetyGuard",
  "DemoRouter",
] as const;

export function SetupHunterTab() {
  const h = useDualHealth();
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 200 });

  // Per (symbol × strategy) — latest decision per pair
  const byPair = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const d of decisions) {
      const sym = normalizeSymbol(d.symbol);
      const strat = String(d.strategy ?? "—");
      const key = `${sym}::${strat}`;
      const existing = map.get(key);
      if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
        map.set(key, d);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const ai = SYMBOLS.indexOf(normalizeSymbol(a.symbol) as any);
      const bi = SYMBOLS.indexOf(normalizeSymbol(b.symbol) as any);
      if (ai !== bi) return ai - bi;
      return String(a.strategy).localeCompare(String(b.strategy));
    });
  }, [decisions]);

  return (
    <div className="flex flex-col gap-3">
      <SelectedCandidatePanel />
      <PerSymbolFunnel decisions={decisions} />

      <Panel
        title="Pipeline Stages"
        right={
          <>
            <Chip tone="dim" outline>READ-ONLY</Chip>
            {h.backend !== "ONLINE" && <Chip tone="warn">BACKEND {h.backend}</Chip>}
          </>
        }
      >
        <div className="flex items-center gap-1 flex-wrap text-[10px] uppercase tracking-[0.14em]" style={{ color: T.dim, fontFamily: "Archivo" }}>
          {STAGES.map((s, i) => (
            <React.Fragment key={s}>
              <span style={{ color: T.txt }}>{s}</span>
              {i < STAGES.length - 1 && <span style={{ color: T.acc }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </Panel>


      <Panel
        title="Candidate Pipeline · per Symbol × Strategy"
        right={<DataStateBadge state={byPair.length === 0 ? "NO_DATA" : h.backend === "ONLINE" ? "LIVE" : "STALE"} />}
      >
        {byPair.length === 0 ? (
          <StatePanel
            state="NO_DATA"
            message="NO CANDIDATE DECISIONS"
            hint="ai_decisions table is empty — backend has not emitted a Setup Hunter cycle yet"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              <thead>
                <tr style={{ color: T.dim, borderBottom: `1px solid ${T.border}` }}>
                  <Th>Symbol</Th>
                  <Th>Strategy</Th>
                  <Th>Decision</Th>
                  <Th>Conf</Th>
                  <Th>Reason / Reject Token</Th>
                  <Th>Stage</Th>
                  <Th>Age</Th>
                </tr>
              </thead>
              <tbody>
                {byPair.map((d, i) => {
                  const age = ageSecFrom(d.created_at);
                  const stale = age != null && age > 600;
                  const dec = String(d.decision ?? "—");
                  const stage = stageFor(dec, d.reason);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: `1px solid ${T.line}`,
                        opacity: stale ? 0.55 : 1,
                      }}
                    >
                      <Td><Chip tone="acc">{normalizeSymbol(d.symbol)}</Chip></Td>
                      <Td>{d.strategy ?? "—"}</Td>
                      <Td>
                        <Chip tone={dec.includes("ROUTE") ? "buy" : dec.includes("ENTER") ? "acc" : "warn"}>
                          {dec.replace(/_/g, " ")}
                        </Chip>
                      </Td>
                      <Td>{fmtConf(d.confidence)}</Td>
                      <Td><ReasonChip reason={d.reason} /></Td>
                      <Td><StageBadge stage={stage} /></Td>
                      <Td>{stale ? <Chip tone="warn">{fmtAge(age)}</Chip> : fmtAge(age)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Reject Token Legend"
        right={<RoleBadge>Reference</RoleBadge>}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {REJECT_TOKENS.map((tok) => (
            <div key={tok.code} className="flex items-start gap-2 text-[10.5px]" style={{ color: T.dim }}>
              <Chip tone={tok.tone as any}>{tok.code}</Chip>
              <span>{tok.desc}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function stageFor(decision: string, reason: any): Stage {
  const d = String(decision).toUpperCase();
  if (d.includes("ROUTE_TO_DEMO")) return "ROUTED";
  if (d.includes("BLOCK")) return "BLOCKED";
  if (d.includes("WAIT")) return "WAITING";
  if (d.includes("ENTER")) return "PASS";
  if (String(reason ?? "").toUpperCase().includes("REJECT")) return "FAIL";
  return "WAITING";
}

function StageBadge({ stage }: { stage: Stage }) {
  const map: Record<Stage, { tone: any; label: string }> = {
    WAITING: { tone: "warn", label: "WAITING" },
    PASS: { tone: "acc", label: "ANALYSIS" },
    FAIL: { tone: "danger", label: "REJECT" },
    BLOCKED: { tone: "danger", label: "BLOCKED" },
    ROUTED: { tone: "buy", label: "ROUTED → DEMO" },
  };
  const v = map[stage];
  return <Chip tone={v.tone}>{v.label}</Chip>;
}

function ReasonChip({ reason }: { reason: any }) {
  const r = String(reason ?? "—").trim();
  if (r === "—" || !r) return <span style={{ color: T.faint }}>—</span>;
  const tok = REJECT_TOKENS.find((t) => r.toUpperCase().includes(t.code));
  if (tok) return <Chip tone={tok.tone as any} title={tok.desc}>{r}</Chip>;
  return <span style={{ color: T.txt }}>{r}</span>;
}

const REJECT_TOKENS: { code: string; desc: string; tone: "warn" | "danger" | "dim" }[] = [
  { code: "NO_EMA_CROSS", desc: "EMA fast/slow has not crossed", tone: "dim" },
  { code: "ATR_TOO_HIGH", desc: "Volatility above setup ceiling", tone: "warn" },
  { code: "ATR_TOO_LOW", desc: "Volatility below setup floor", tone: "warn" },
  { code: "RR_TOO_LOW", desc: "Risk:Reward below minimum threshold", tone: "warn" },
  { code: "NO_ALLOWED_EXECUTION_CANDIDATE", desc: "No strategy produced a routable candidate", tone: "dim" },
  { code: "NO_GOLD_EXECUTION_CANDIDATE", desc: "No GOLD candidate met the route criteria", tone: "dim" },
  { code: "SMC_MTFA_STRONG_FAIL_WITH_LOW_CONFLUENCE", desc: "SMC multi-timeframe alignment failed", tone: "warn" },
  { code: "SPREAD_TOO_WIDE", desc: "Live spread exceeds symbol cap", tone: "warn" },
  { code: "SESSION_BLOCKED", desc: "Outside allowed trading session", tone: "warn" },
  { code: "COOLDOWN_ACTIVE", desc: "Strategy in post-trade cooldown", tone: "dim" },
  { code: "INVALID_FIELD", desc: "Candidate field failed validation", tone: "danger" },
  { code: "MISSING_FIELD", desc: "Required candidate field absent", tone: "danger" },
  { code: "RR_INVALID", desc: "Risk:Reward malformed", tone: "danger" },
  { code: "VALUE_OUT_OF_RANGE", desc: "Field outside allowed numeric range", tone: "danger" },
];

function fmtConf(c: any): string {
  if (c == null) return "—";
  const n = Number(c);
  if (!Number.isFinite(n)) return "—";
  if (n <= 1) return (n * 100).toFixed(0) + "%";
  return n.toFixed(0) + "%";
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-semibold uppercase tracking-[0.14em] px-2 py-1.5" style={{ fontFamily: "Archivo", color: T.dim }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 align-middle" style={{ color: T.txt }}>{children}</td>;
}

const SYMS = ["BTCUSD#", "GOLD#", "EURUSD", "US100Cash#"] as const;

function SelectedCandidatePanel() {
  const ds: any = useDashboardStatusPayload();
  const sh = ds?.setup_hunter ?? {};
  const best = sh.best_candidate ?? {};
  const hasBest = best && (best.symbol || best.strategy || best.score != null || best.grade);

  return (
    <Panel
      title="Selected Candidate"
      right={
        <>
          <RoleBadge>SETUP HUNTER · best_candidate</RoleBadge>
          {!hasBest && <Chip tone="dim">NO SELECTION</Chip>}
        </>
      }
    >
      {!hasBest ? (
        <StatePanel state="NO_DATA" message="NO BEST CANDIDATE" hint="setup_hunter.best_candidate fields are null" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4">
          <KV label="Symbol" value={best.broker_symbol ?? best.symbol ?? "—"} tone="acc" />
          <KV label="Strategy" value={best.strategy ?? "—"} />
          <KV label="Direction" value={best.direction ?? "—"} tone={best.direction === "BUY" ? "buy" : best.direction === "SELL" ? "sell" : "dim"} />
          <KV label="Grade" value={best.grade ?? "—"} tone={best.grade === "A" || best.grade === "B" ? "buy" : best.grade === "D" ? "sell" : "warn"} />
          <KV label="Score" value={best.score ?? "—"} />
          <KV label="RR" value={best.rr ?? "—"} />
          <KV label="Entry" value={best.entry ?? "—"} />
          <KV label="SL / TP" value={`${best.sl ?? "—"} / ${best.tp ?? "—"}`} />
          <KV label="SMC" value={best.smc_score ?? "—"} />
          <KV label="MTFA" value={best.mtfa_score ?? "—"} />
          <KV label="Demo Eligible" value={best.demo_eligible === true ? "TRUE" : best.demo_eligible === false ? "FALSE" : "—"} tone={best.demo_eligible ? "buy" : "warn"} />
          <KV label="Near Miss" value={best.near_miss_reason ?? "—"} />
          {Array.isArray(best.failed_gates) && best.failed_gates.length > 0 && (
            <div className="col-span-2 md:col-span-4 mt-1 flex flex-wrap gap-1">
              {best.failed_gates.map((g: any, i: number) => <Chip key={i} tone="warn">{String(g)}</Chip>)}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function PerSymbolFunnel({ decisions }: { decisions: any[] }) {
  const ds: any = useDashboardStatusPayload();
  const sh = ds?.setup_hunter ?? {};
  const recent: any[] = Array.isArray(sh.latest_by_symbol_strategy) ? sh.latest_by_symbol_strategy : [];

  // Build per-symbol counts from latest_by_symbol_strategy if present, else from ai_decisions
  const source = recent.length > 0
    ? recent.map((r) => ({
        symbol: normalizeSymbol(r.symbol ?? r.broker_symbol),
        decision: r.decision ?? r.status,
        reason: r.reason ?? r.reject_reason,
      }))
    : decisions.map((d) => ({
        symbol: normalizeSymbol(d.symbol),
        decision: d.decision,
        reason: d.reason,
      }));

  return (
    <Panel
      title="Per-Symbol Funnel"
      right={<DataStateBadge state={source.length === 0 ? "NO_DATA" : "LIVE"} />}
    >
      {source.length === 0 ? (
        <StatePanel state="NO_DATA" message="NO CANDIDATE STREAM" hint="setup_hunter.latest_by_symbol_strategy empty and ai_decisions empty" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {SYMS.map((sym) => {
            const items = source.filter((s) => s.symbol === sym);
            const accepted = items.filter((s) => /ROUTE|ENTER|ACCEPT/i.test(String(s.decision ?? "")));
            const rejected = items.filter((s) => /REJECT|BLOCK|FAIL/i.test(String(s.decision ?? "")));
            const waits = items.filter((s) => /WAIT/i.test(String(s.decision ?? "")));
            const lastReject = rejected[0]?.reason ?? items.find((s) => s.reason)?.reason ?? null;
            return (
              <div key={sym} className="p-2 flex flex-col gap-1" style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6 }}>
                <div className="flex items-center justify-between">
                  <Chip tone="acc">{sym}</Chip>
                  <span className="text-[10px]" style={{ color: T.dim }}>{items.length} candidates</span>
                </div>
                <KV label="Accepted" value={accepted.length} tone={accepted.length > 0 ? "buy" : "dim"} />
                <KV label="WAIT" value={waits.length} tone={waits.length > 0 ? "warn" : "dim"} />
                <KV label="Rejected" value={rejected.length} tone={rejected.length > 0 ? "sell" : "dim"} />
                <KV label="Last Reject Reason" value={lastReject ?? "—"} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
