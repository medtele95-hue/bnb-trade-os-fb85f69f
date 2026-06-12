import * as React from "react";
import { Panel, KV, Chip, T, StatePanel, RoleBadge, FreshnessBadge, fmtMoney, fmtAge, ageSecFrom, useTick } from "../primitives";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useLatestSnapshot, useDualHealth } from "../health";

export function RiskPnlTab() {
  const snap = useLatestSnapshot();
  const h = useDualHealth();
  const now = useTick(1000);
  const { rows: trades } = useLiveTable<any>("trades", { orderBy: "opened_at", ascending: false, limit: 500 });
  const { rows: snapHistory } = useLiveTable<any>("account_snapshots", { orderBy: "snapshot_time", ascending: false, limit: 200 });

  const snapAge = ageSecFrom(snap?.snapshot_time ?? snap?.created_at, now);

  // PnL from MT5 snapshot (source of truth)
  const balance = snap?.balance;
  const equity = snap?.equity;
  const floating = snap?.profit;
  const dailyPnl = snap?.daily_pnl ?? snap?.raw_payload?.daily_pnl;
  const totalPnl = snap?.total_pnl ?? snap?.raw_payload?.total_pnl;

  // Trades-derived (flag if ingest degraded)
  const open = trades.filter((t) => String(t.result ?? "").toUpperCase() === "OPEN");
  const closed = trades.filter((t) => String(t.result ?? "").toUpperCase() === "CLOSED");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const closedToday = closed.filter((t) => t.closed_at && new Date(t.closed_at) >= today);
  const closedPnlTradesToday = closedToday.reduce((a, t) => a + Number(t.pnl ?? 0), 0);
  const closedPnlAll = closed.reduce((a, t) => a + Number(t.pnl ?? 0), 0);

  const trustTrades = h.ingest === "LIVE";

  // Per-symbol concentration
  const bySymbol = React.useMemo(() => {
    const m = new Map<string, { count: number; pnl: number; wins: number; losses: number; open: number }>();
    for (const t of trades) {
      const k = String(t.symbol ?? "—");
      const e = m.get(k) ?? { count: 0, pnl: 0, wins: 0, losses: 0, open: 0 };
      e.count += 1;
      const pnl = Number(t.pnl ?? 0);
      e.pnl += pnl;
      if (String(t.result).toUpperCase() === "OPEN") e.open += 1;
      else if (pnl > 0) e.wins += 1;
      else if (pnl < 0) e.losses += 1;
      m.set(k, e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [trades]);

  // Concentration warning — flag symbol with worst PnL when total negative
  const worst = bySymbol.reduce<{ sym: string; pnl: number } | null>((a, [sym, e]) => {
    if (!a || e.pnl < a.pnl) return { sym, pnl: e.pnl };
    return a;
  }, null);
  const showBleed = worst && worst.pnl < -50;

  return (
    <div className="flex flex-col gap-3">
      {h.ingest !== "LIVE" && (
        <div
          className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] flex items-center gap-3"
          style={{ background: "rgba(240,180,41,0.08)", border: `1px solid ${T.warn}66`, color: T.warn, borderRadius: 6 }}
        >
          <span>INGEST {h.ingest.replace("_", " ")}</span>
          <span style={{ color: T.dim }}>Trades-table figures may be incomplete. MT5 snapshot remains the source of truth.</span>
        </div>
      )}

      <div className="grid grid-cols-12 gap-3">
        <Panel
          title="PnL Truth · MT5 Snapshot"
          right={<FreshnessBadge ageSec={snapAge} staleAfter={120} />}
          className="col-span-12 lg:col-span-6"
        >
          {snap ? (
            <div className="grid grid-cols-2 gap-x-4">
              <KV label="Balance" value={fmtMoney(balance)} />
              <KV label="Equity" value={fmtMoney(equity)} />
              <KV label="Floating PnL" value={fmtMoney(floating)} tone={Number(floating) > 0 ? "buy" : Number(floating) < 0 ? "sell" : undefined} />
              <KV label="Closed PnL (today, trades)" value={fmtMoney(closedPnlTradesToday)} tone={closedPnlTradesToday > 0 ? "buy" : closedPnlTradesToday < 0 ? "sell" : undefined} />
              <KV label="Daily PnL (backend)" value={dailyPnl != null ? fmtMoney(dailyPnl) : "—"} />
              <KV label="Total PnL (backend)" value={totalPnl != null ? fmtMoney(totalPnl) : "—"} />
              <KV label="Source" value={snap?.source ?? "MT5"} tone="acc" />
              <KV label="Snapshot Age" value={fmtAge(snapAge)} />
            </div>
          ) : (
            <StatePanel state="NO_DATA" message="NO MT5 SNAPSHOT" />
          )}
        </Panel>

        <Panel title="Risk Limits" className="col-span-12 lg:col-span-3">
          <KV label="Max Lot Cap" value="0.01" tone="acc" />
          <KV label="Magic" value="909002" />
          <KV label="Allow Live" value="FALSE" tone="buy" />
          <KV label="Demo Only" value="TRUE" tone="buy" />
          <KV label="Open Positions" value={open.length} />
        </Panel>

        <Panel title="Today" className="col-span-12 lg:col-span-3">
          <KV label="Closed Trades Today" value={closedToday.length} />
          <KV label="Open Right Now" value={open.length} />
          <KV label="Closed PnL Today (trades)" value={fmtMoney(closedPnlTradesToday)} tone={closedPnlTradesToday > 0 ? "buy" : closedPnlTradesToday < 0 ? "sell" : undefined} />
          {!trustTrades && <div className="text-[10px] mt-1" style={{ color: T.warn }}>Numbers may lag — ingest {h.ingest}.</div>}
        </Panel>
      </div>

      <Panel
        title="Per-Symbol Exposure & PnL"
        right={
          <>
            <RoleBadge>FROM trades TABLE</RoleBadge>
            {!trustTrades && <Chip tone="warn">MAY BE INCOMPLETE</Chip>}
          </>
        }
      >
        {bySymbol.length === 0 ? (
          <StatePanel state="NO_DATA" message="trades TABLE EMPTY" />
        ) : (
          <table className="w-full text-[11px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            <thead style={{ color: T.dim, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <Th>Symbol</Th><Th>Trades</Th><Th>Open</Th><Th>Wins</Th><Th>Losses</Th><Th>Win %</Th><Th align="right">Cumulative PnL</Th>
              </tr>
            </thead>
            <tbody>
              {bySymbol.map(([sym, e]) => {
                const total = e.wins + e.losses;
                const wr = total ? (e.wins / total) * 100 : 0;
                const tone: any = e.pnl > 0 ? "buy" : e.pnl < 0 ? "sell" : undefined;
                return (
                  <tr key={sym} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <Td><Chip tone="acc">{sym}</Chip></Td>
                    <Td>{e.count}</Td>
                    <Td>{e.open}</Td>
                    <Td style={{ color: T.buy }}>{e.wins}</Td>
                    <Td style={{ color: T.sell }}>{e.losses}</Td>
                    <Td>{wr.toFixed(0)}%</Td>
                    <Td align="right"><span style={{ color: tone === "buy" ? T.buy : tone === "sell" ? T.sell : T.txt }}>{fmtMoney(e.pnl)}</span></Td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: `1px solid ${T.border}`, color: T.dim }}>
                <Td><b>TOTAL</b></Td>
                <Td>{trades.length}</Td>
                <Td>{open.length}</Td>
                <Td></Td><Td></Td><Td></Td>
                <Td align="right"><b style={{ color: closedPnlAll > 0 ? T.buy : closedPnlAll < 0 ? T.sell : T.txt }}>{fmtMoney(closedPnlAll)}</b></Td>
              </tr>
            </tbody>
          </table>
        )}
        {showBleed && (
          <div
            className="mt-3 px-3 py-2 text-[11px] uppercase tracking-[0.14em] flex items-center gap-3"
            style={{ background: "rgba(234,57,67,0.08)", border: `1px solid ${T.sell}66`, color: T.sell, borderRadius: 6 }}
          >
            ▲ CONCENTRATION WARNING · {worst!.sym} cumulative PnL {fmtMoney(worst!.pnl)} — review strategy gating for this symbol.
          </div>
        )}
      </Panel>

      <Panel
        title="Equity Series · account_snapshots"
        right={<RoleBadge>HISTORICAL</RoleBadge>}
      >
        {snapHistory.length === 0 ? (
          <StatePanel state="NO_DATA" message="NO HISTORICAL SNAPSHOTS" />
        ) : (
          <EquitySparkline rows={snapHistory.slice().reverse()} />
        )}
      </Panel>
    </div>
  );
}

function EquitySparkline({ rows }: { rows: any[] }) {
  const points = rows
    .map((r) => Number(r.equity ?? r.balance))
    .filter((n) => Number.isFinite(n));
  if (points.length < 2) return <StatePanel state="NO_DATA" message="NOT ENOUGH POINTS" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 600, H = 80;
  const step = W / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(H - ((p - min) / range) * H).toFixed(1)}`).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 120 }}>
        <path d={path} fill="none" stroke={T.acc} strokeWidth={1.2} />
      </svg>
      <div className="flex justify-between text-[10px] tabular-nums" style={{ color: T.dim, fontFamily: "JetBrains Mono, monospace" }}>
        <span>min {min.toFixed(2)}</span>
        <span>{points.length} snapshots</span>
        <span>max {max.toFixed(2)}</span>
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <th className="px-2 py-1.5 font-semibold uppercase tracking-[0.14em]" style={{ fontFamily: "Archivo", textAlign: align ?? "left", color: T.dim }}>{children}</th>;
}
function Td({ children, align, style }: { children?: React.ReactNode; align?: "right"; style?: React.CSSProperties }) {
  return <td className="px-2 py-1.5" style={{ textAlign: align ?? "left", color: T.txt, ...style }}>{children}</td>;
}
