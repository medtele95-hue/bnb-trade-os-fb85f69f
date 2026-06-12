import * as React from "react";
import { Panel, Chip, T, StatePanel, fmtMoney, fmtAge, ageSecFrom, DataStateBadge } from "../primitives";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDualHealth } from "../health";

const RECONCILED_REASONS = ["MT5_POSITION_MISSING_CLOSED", "MT5_HISTORY_RECONCILED", "RECONCILED"];

function isReconciled(t: any): boolean {
  const r = String(t?.raw_payload?.close_reason ?? t?.reason ?? "").toUpperCase();
  return RECONCILED_REASONS.some((x) => r.includes(x));
}
function isReconstructed(t: any): boolean {
  const lot = Number(t?.lot ?? t?.lot_size);
  const pnl = Number(t?.pnl);
  return !Number.isFinite(lot) || lot === 0 || (pnl === 0 && String(t?.result).toUpperCase() === "CLOSED" && isReconciled(t));
}

export function TradesTab() {
  const h = useDualHealth();
  const { rows: trades } = useLiveTable<any>("trades", { orderBy: "opened_at", ascending: false, limit: 500 });

  const [symFilter, setSymFilter] = React.useState<string>("ALL");
  const [stratFilter, setStratFilter] = React.useState<string>("ALL");

  const symbols = React.useMemo(() => Array.from(new Set(trades.map((t) => t.symbol).filter(Boolean))), [trades]);
  const strats = React.useMemo(() => Array.from(new Set(trades.map((t) => t.strategy).filter(Boolean))), [trades]);

  const filtered = trades.filter((t) =>
    (symFilter === "ALL" || t.symbol === symFilter) &&
    (stratFilter === "ALL" || t.strategy === stratFilter)
  );
  const open = filtered.filter((t) => String(t.result ?? "").toUpperCase() === "OPEN");
  const closed = filtered.filter((t) => String(t.result ?? "").toUpperCase() === "CLOSED");

  return (
    <div className="flex flex-col gap-3">
      {h.ingest !== "LIVE" && (
        <div
          className="px-3 py-2 text-[11px] uppercase tracking-[0.14em]"
          style={{ background: "rgba(240,180,41,0.08)", border: `1px solid ${T.warn}66`, color: T.warn, borderRadius: 6 }}
        >
          INGEST {h.ingest.replace("_", " ")} · trade rows may lag behind MT5
        </div>
      )}

      <Panel title="Filters">
        <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: T.dim, fontFamily: "Archivo" }}>
          <span>Symbol:</span>
          <FilterBtn active={symFilter === "ALL"} onClick={() => setSymFilter("ALL")}>ALL</FilterBtn>
          {symbols.map((s) => <FilterBtn key={s} active={symFilter === s} onClick={() => setSymFilter(s)}>{s}</FilterBtn>)}
          <span className="ml-3">Strategy:</span>
          <FilterBtn active={stratFilter === "ALL"} onClick={() => setStratFilter("ALL")}>ALL</FilterBtn>
          {strats.map((s) => <FilterBtn key={s} active={stratFilter === s} onClick={() => setStratFilter(s)}>{s}</FilterBtn>)}
        </div>
      </Panel>

      <Panel
        title={`Open Positions · ${open.length}`}
        right={<DataStateBadge state={trades.length === 0 ? "NO_DATA" : h.ingest === "LIVE" ? "LIVE" : "DEGRADED"} />}
      >
        {open.length === 0
          ? <StatePanel state="NO_DATA" message="NO OPEN POSITIONS" />
          : <TradeTable rows={open} kind="open" />}
      </Panel>

      <Panel
        title={`Closed Trades · ${closed.length}`}
        right={<DataStateBadge state={closed.length === 0 ? "NO_DATA" : h.ingest === "LIVE" ? "LIVE" : "DEGRADED"} />}
      >
        {closed.length === 0
          ? <StatePanel state="NO_DATA" message="NO CLOSED TRADES" />
          : <TradeTable rows={closed.slice(0, 200)} kind="closed" />}
      </Panel>
    </div>
  );
}

function TradeTable({ rows, kind }: { rows: any[]; kind: "open" | "closed" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10.5px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
        <thead style={{ color: T.dim, borderBottom: `1px solid ${T.border}` }}>
          <tr>
            <Th>Symbol</Th><Th>Strategy</Th><Th>Dir</Th><Th>Lot</Th>
            <Th align="right">Entry</Th><Th align="right">SL</Th><Th align="right">TP</Th>
            <Th align="right">Profit</Th>
            <Th>Ticket</Th><Th>Magic</Th>
            <Th>Open</Th>{kind === "closed" && <Th>Close</Th>}
            <Th>Reason / Setup</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const recon = isReconciled(t);
            const rec = isReconstructed(t);
            const dir = String(t.dir ?? "—").toUpperCase();
            const pnl = Number(t.pnl ?? 0);
            const closeReason = t?.raw_payload?.close_reason ?? null;
            return (
              <tr
                key={t.id ?? i}
                style={{
                  borderBottom: `1px solid ${T.line}`,
                  background: rec ? "rgba(240,180,41,0.04)" : undefined,
                }}
              >
                <Td><Chip tone="acc">{t.symbol}</Chip></Td>
                <Td>{t.strategy ?? "—"}</Td>
                <Td><Chip tone={dir === "BUY" ? "buy" : dir === "SELL" ? "sell" : "dim"}>{dir}</Chip></Td>
                <Td>{t.lot ?? t.lot_size ?? "—"}</Td>
                <Td align="right">{fmtN(t.entry, 5)}</Td>
                <Td align="right">{fmtN(t.sl, 5)}</Td>
                <Td align="right">{fmtN(t.tp, 5)}</Td>
                <Td align="right">
                  <span style={{ color: pnl > 0 ? T.buy : pnl < 0 ? T.sell : T.txt }}>{fmtMoney(pnl)}</span>
                </Td>
                <Td>{t.ticket ?? "—"}</Td>
                <Td>{t.magic_number ?? t.magic ?? "—"}</Td>
                <Td>{shortTime(t.opened_at)}</Td>
                {kind === "closed" && <Td>{shortTime(t.closed_at)}</Td>}
                <Td>
                  <div className="flex flex-wrap gap-1 items-center">
                    {recon && <Chip tone="warn" title="Reconciliation artifact — not a real TP/SL exit">RECONCILED</Chip>}
                    {rec && !recon && <Chip tone="warn">RECONSTRUCTED</Chip>}
                    <span style={{ color: T.dim }}>{closeReason ?? t.reason ?? "—"}</span>
                  </div>
                </Td>
                <Td>
                  <Chip tone={String(t.result).toUpperCase() === "OPEN" ? "buy" : "dim"}>{t.result ?? "—"}</Chip>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilterBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
      style={{
        background: active ? T.acc : "transparent",
        color: active ? "#04060c" : T.dim,
        border: `1px solid ${active ? T.acc : T.border}`,
        borderRadius: 3,
        fontFamily: "Archivo",
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}
function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <th className="px-2 py-1.5 font-semibold uppercase tracking-[0.14em] text-left" style={{ fontFamily: "Archivo", textAlign: align ?? "left", color: T.dim }}>{children}</th>;
}
function Td({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return <td className="px-2 py-1.5 align-middle" style={{ textAlign: align ?? "left", color: T.txt }}>{children}</td>;
}
function fmtN(v: any, d = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v); if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}
function shortTime(ts: any): string {
  if (!ts) return "—";
  const d = new Date(String(ts).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(5, 16).replace("T", " ");
}
