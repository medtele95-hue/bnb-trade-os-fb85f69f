import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, gradeTone, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";

function unknownIf(v: any) {
  return v == null || v === "" ? "UNKNOWN" : v;
}

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`;
}

export function PaperReport() {
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 200 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 200 });
  const { rows: signals } = useLiveTable<any>("strategy_signals", { limit: 200 });

  // SAFETY GUARD SUMMARY (from ai_decisions)
  let blocked = 0, caution = 0, allowed = 0;
  const blockedByReason: Record<string, number> = {};
  const blockedBySymbol: Record<string, number> = {};
  const blockedByStrategy: Record<string, number> = {};
  const blockedByHour: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  for (const d of decisions) {
    const rp = d.raw_payload ?? {};
    const s = String(rp.safety_guard_status ?? "").toUpperCase();
    if (s === "BLOCK" || s === "BLOCKED") {
      blocked++;
      const r = String(rp.safety_guard_reason ?? "—");
      blockedByReason[r] = (blockedByReason[r] ?? 0) + 1;
      if (d.symbol) blockedBySymbol[d.symbol] = (blockedBySymbol[d.symbol] ?? 0) + 1;
      if (d.strategy) blockedByStrategy[d.strategy] = (blockedByStrategy[d.strategy] ?? 0) + 1;
      const h = rp.safety_guard_local_hour;
      if (h != null) blockedByHour[String(h)] = (blockedByHour[String(h)] ?? 0) + 1;
    } else if (s === "CAUTION") caution++;
    else if (s === "PASS") allowed++;
    const tags = rp.big_setup_tags;
    if (Array.isArray(tags)) for (const t of tags) tagCount[t] = (tagCount[t] ?? 0) + 1;
  }

  // BIG SETUP PERFORMANCE (group trades by big_setup_grade in raw_payload)
  type Stats = { trades: number; wins: number; losses: number; pnl: number; grossWin: number; grossLoss: number };
  const empty = (): Stats => ({ trades: 0, wins: 0, losses: 0, pnl: 0, grossWin: 0, grossLoss: 0 });
  const byGrade: Record<string, Stats> = {};
  const byStrategy: Record<string, Stats> = {};
  const bySymbol: Record<string, Stats> = {};
  const confBuckets: Record<string, Stats & { confSum: number }> = {};
  const wins: any[] = [], losses: any[] = [];

  for (const t of trades) {
    const pnl = Number(t.pnl ?? 0);
    if (pnl === 0 && !t.closed_at) continue;
    const result = String(t.result ?? "").toUpperCase();
    const win = result === "WIN" || pnl > 0;
    const loss = result === "LOSS" || pnl < 0;
    const rp = t.raw_payload ?? {};
    const grade = rp.big_setup_grade ?? "UNKNOWN";
    const strat = t.strategy ?? "UNKNOWN";
    const sym = t.symbol ?? "UNKNOWN";
    const conf = Number(t.confidence ?? rp.confidence ?? 0);
    const bucket = conf >= 80 ? "80-100" : conf >= 60 ? "60-80" : conf >= 40 ? "40-60" : conf > 0 ? "0-40" : "UNKNOWN";

    for (const [map, key] of [[byGrade, grade], [byStrategy, strat], [bySymbol, sym]] as const) {
      if (!map[key]) map[key] = empty();
      map[key].trades++;
      map[key].pnl += pnl;
      if (win) { map[key].wins++; map[key].grossWin += pnl; }
      if (loss) { map[key].losses++; map[key].grossLoss += Math.abs(pnl); }
    }
    if (!confBuckets[bucket]) confBuckets[bucket] = { ...empty(), confSum: 0 };
    confBuckets[bucket].trades++;
    confBuckets[bucket].pnl += pnl;
    confBuckets[bucket].confSum += conf;
    if (win) confBuckets[bucket].wins++;
    if (loss) confBuckets[bucket].losses++;

    if (win) wins.push({ ...t, _grade: grade });
    if (loss) losses.push({ ...t, _grade: grade });
  }
  wins.sort((a, b) => Number(b.pnl ?? 0) - Number(a.pnl ?? 0));
  losses.sort((a, b) => Number(a.pnl ?? 0) - Number(b.pnl ?? 0));

  const winRate = (s: Stats) => (s.trades > 0 ? s.wins / s.trades : 0);
  const pf = (s: Stats) => (s.grossLoss > 0 ? s.grossWin / s.grossLoss : s.grossWin > 0 ? Infinity : 0);

  // STRATEGY REPLACEMENT
  const ACTIVE = ["BREAKOUT_RETEST", "CRT_TBS_REVERSAL", "AMD_FVG_IFVG_REVERSAL", "FIB_OTE_RETEST", "EMA_PULLBACK"];
  const LEGACY = ["SECOND_ENTRY", "SCALPING_AGENT"];
  const newSkips = signals.filter((s) => ACTIVE.includes(s.strategy) && ["WAIT", "SKIP", "SKIPPED"].includes(String(s.signal ?? "").toUpperCase())).length;
  const activeStats = ACTIVE.map((n) => ({ name: n, s: byStrategy[n] ?? empty() }));
  const best = [...activeStats].sort((a, b) => b.s.pnl - a.s.pnl)[0];
  const worst = [...activeStats].sort((a, b) => a.s.pnl - b.s.pnl)[0];

  const totalDecisions = decisions.length;
  if (totalDecisions === 0 && trades.length === 0) {
    return (
      <Panel title="PAPER REPORT" right="OBSERVATIONAL">
        <Waiting label="WAITING FOR PAPER REPORT DATA" />
      </Panel>
    );
  }

  const top = (m: Record<string, number>, n = 5) =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);

  return (
    <Panel title="PAPER REPORT" right="OBSERVATIONAL">
      {/* SAFETY GUARD SUMMARY */}
      <div className="border-b border-dashed border-black/40 pb-2 mb-2">
        <div className="font-bold text-[11px] uppercase tracking-widest mb-1">Safety Guard Summary</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[9px] opacity-70">Allowed</div><div className="pixel text-[18px] text-profit">{allowed}</div></div>
          <div><div className="text-[9px] opacity-70">Caution</div><div className="pixel text-[18px]">{caution}</div></div>
          <div><div className="text-[9px] opacity-70">Blocked</div><div className="pixel text-[18px] text-loss">{blocked}</div></div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-2 text-[10px]">
          {[
            ["Blocked by Reason", blockedByReason],
            ["Blocked by Symbol", blockedBySymbol],
            ["Blocked by Strategy", blockedByStrategy],
            ["Blocked by Hour", blockedByHour],
          ].map(([label, m]: any) => (
            <div key={label}>
              <div className="font-bold uppercase opacity-70">{label}</div>
              {top(m, 4).length === 0 ? <div className="opacity-60">—</div> : top(m, 4).map(([k, v]) => (
                <div key={k} className="truncate">{v as any}× {k}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* BIG SETUP SUMMARY */}
      <div className="border-b border-dashed border-black/40 pb-2 mb-2">
        <div className="font-bold text-[11px] uppercase tracking-widest mb-1">Big Setup Summary</div>
        <table className="w-full text-[10px]">
          <thead><tr className="border-b border-black uppercase text-left">
            <th>Grade</th><th>Trades</th><th>Wins</th><th>Losses</th><th>Win Rate</th><th>PnL</th><th>PF</th>
          </tr></thead>
          <tbody>
            {Object.entries(byGrade).map(([g, s]) => (
              <tr key={g} className="border-b border-dashed border-black/30">
                <td><Badge value={g} tone={gradeTone(g)} /></td>
                <td>{s.trades}</td><td>{s.wins}</td><td>{s.losses}</td>
                <td>{pct(winRate(s))}</td>
                <td className={s.pnl >= 0 ? "text-profit" : "text-loss"}>{s.pnl.toFixed(2)}</td>
                <td>{pf(s) === Infinity ? "∞" : pf(s).toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(byGrade).length === 0 && <tr><td colSpan={7} className="opacity-60 py-1">—</td></tr>}
          </tbody>
        </table>
        <div className="mt-2 text-[10px]">
          <div className="font-bold uppercase opacity-70">Top Setup Tags</div>
          {top(tagCount, 6).length === 0 ? <div className="opacity-60">—</div> : (
            <div className="flex flex-wrap gap-1 mt-1">
              {top(tagCount, 6).map(([k, v]) => <Badge key={k} value={`${v}× ${k}`} tone="gray" />)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2 text-[10px]">
          <div>
            <div className="font-bold uppercase opacity-70">Biggest Wins</div>
            {wins.slice(0, 3).map((t) => (
              <div key={t.id} className="truncate">+${Number(t.pnl).toFixed(2)} · {t.symbol} · <Badge value={t._grade} tone={gradeTone(t._grade)} /></div>
            ))}
            {wins.length === 0 && <div className="opacity-60">—</div>}
          </div>
          <div>
            <div className="font-bold uppercase opacity-70">Biggest Losses</div>
            {losses.slice(0, 3).map((t) => (
              <div key={t.id} className="truncate">${Number(t.pnl).toFixed(2)} · {t.symbol} · <Badge value={t._grade} tone={gradeTone(t._grade)} /></div>
            ))}
            {losses.length === 0 && <div className="opacity-60">—</div>}
          </div>
        </div>
      </div>

      {/* CONFIDENCE CALIBRATION */}
      <div className="border-b border-dashed border-black/40 pb-2 mb-2">
        <div className="font-bold text-[11px] uppercase tracking-widest mb-1">Confidence Calibration</div>
        <table className="w-full text-[10px]">
          <thead><tr className="border-b border-black uppercase text-left">
            <th>Bucket</th><th>Trades</th><th>Win Rate</th><th>PnL</th><th>Avg Conf</th>
          </tr></thead>
          <tbody>
            {Object.entries(confBuckets).map(([b, s]) => (
              <tr key={b} className="border-b border-dashed border-black/30">
                <td>{b}</td>
                <td>{s.trades}</td>
                <td>{pct(winRate(s))}</td>
                <td className={s.pnl >= 0 ? "text-profit" : "text-loss"}>{s.pnl.toFixed(2)}</td>
                <td>{s.trades > 0 ? (s.confSum / s.trades).toFixed(1) : "—"}</td>
              </tr>
            ))}
            {Object.keys(confBuckets).length === 0 && <tr><td colSpan={5} className="opacity-60 py-1">—</td></tr>}
          </tbody>
        </table>
      </div>

      {/* STRATEGY REPLACEMENT SUMMARY */}
      <div className="border-b border-dashed border-black/40 pb-2 mb-2">
        <div className="font-bold text-[11px] uppercase tracking-widest mb-1">Strategy Replacement Summary</div>
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          <KV k="Active Strategies" v={ACTIVE.join(", ")} />
          <KV k="Legacy Observer" v={LEGACY.join(", ")} />
          <KV k="Best New Strategy" v={best ? `${best.name} (${best.s.pnl.toFixed(2)})` : "UNKNOWN"} />
          <KV k="Worst New Strategy" v={worst ? `${worst.name} (${worst.s.pnl.toFixed(2)})` : "UNKNOWN"} />
          <KV k="New Strategy Skips" v={newSkips} />
        </div>
      </div>

      {/* NEW STRATEGY PERFORMANCE */}
      <div>
        <div className="font-bold text-[11px] uppercase tracking-widest mb-1">New Strategy Performance</div>
        <div className="grid grid-cols-3 gap-2">
          {["CRT_TBS_REVERSAL", "AMD_FVG_IFVG_REVERSAL", "FIB_OTE_RETEST"].map((name) => {
            const s = byStrategy[name] ?? empty();
            const latestSig = signals.find((x) => x.strategy === name);
            const rp = latestSig?.raw_payload ?? {};
            const avgScore = rp.strategy_score ?? rp[`${name.toLowerCase()}_score`] ?? "UNKNOWN";
            const skip = latestSig && ["WAIT", "SKIP", "SKIPPED"].includes(String(latestSig.signal ?? "").toUpperCase())
              ? (latestSig.blocked_reason ?? latestSig.reason ?? "—")
              : "—";
            return (
              <div key={name} className="border border-black p-2 text-[10px]">
                <div className="font-bold text-[11px] mb-1">{name}</div>
                <KV k="Trades" v={s.trades} />
                <KV k="Wins" v={s.wins} />
                <KV k="Losses" v={s.losses} />
                <KV k="Win Rate" v={pct(winRate(s))} />
                <KV k="PnL" v={s.pnl.toFixed(2)} accent={s.pnl >= 0 ? "profit" : "loss"} />
                <KV k="Profit Factor" v={pf(s) === Infinity ? "∞" : pf(s).toFixed(2)} />
                <KV k="Avg Score" v={String(unknownIf(avgScore))} />
                <KV k="Main Skip" v={String(skip)} />
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
