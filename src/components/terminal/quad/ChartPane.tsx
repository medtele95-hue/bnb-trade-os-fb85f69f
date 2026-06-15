import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeCandles, type RawCandle } from "@/lib/candles";
import { T } from "../primitives";

type Levels = {
  entry?: number | null;
  sl?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  support?: number | null;
  resistance?: number | null;
  vwap?: number | null;
  poc?: number | null;
  vah?: number | null;
  val?: number | null;
  session_high?: number | null;
  session_low?: number | null;
} | null;

const TF = "M5";
const VISIBLE = 90;
const FETCH = 200;

// Map UI broker symbol → backend market_candles symbol naming.
function candleSymbol(broker: string): string[] {
  const bare = broker.replace(/#$/, "");
  // Try both with and without # — whichever the backend stores.
  return [broker, bare];
}

export function ChartPane({ symbol, levels }: { symbol: string; levels: Levels }) {
  const [raw, setRaw] = useState<RawCandle[] | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const variants = candleSymbol(symbol);

    const load = async () => {
      try {
        let data: any[] | null = null;
        for (const v of variants) {
          const res = await supabase
            .from("market_candles" as any)
            .select("*")
            .eq("symbol", v)
            .eq("timeframe", TF)
            .order("candle_time", { ascending: false })
            .limit(FETCH);
          if (res.data && res.data.length > 0) {
            data = res.data;
            break;
          }
          if (!data) data = res.data;
        }
        if (cancelled) return;
        setRaw((data ?? []) as unknown as RawCandle[]);
        setErrored(false);
      } catch {
        if (cancelled) return;
        setErrored(true);
        setRaw([]);
      }
    };
    load();

    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`quad:candles:${symbol}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "market_candles" },
          () => load(),
        )
        .subscribe();
    } catch {
      // realtime unavailable — polling will keep us fresh
    }
    const poll = window.setInterval(load, 30000);

    return () => {
      cancelled = true;
      if (ch) { try { supabase.removeChannel(ch); } catch {} }
      window.clearInterval(poll);
    };
  }, [symbol]);

  const { candles } = useMemo(
    () => sanitizeCandles(raw, { limit: VISIBLE, timeframe: TF }),
    [raw],
  );

  if (raw === null) return <Overlay label="LOADING CANDLES" />;
  if (errored) return <Overlay label="WAITING DATA" sub="chart backend unavailable" />;
  if (candles.length === 0) return <Overlay label="WAITING DATA" sub={`no ${TF} candles for ${symbol}`} />;

  const w = 900;
  const h = 240;
  const padL = 8;
  const padR = 70;
  const padT = 8;
  const padB = 18;
  const cw = (w - padL - padR) / candles.length;

  // Compute Y range across candles + visible levels
  const ys: number[] = [];
  for (const c of candles) { ys.push(c.high, c.low); }
  if (levels) {
    for (const v of Object.values(levels)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) ys.push(n);
    }
  }
  const hi = Math.max(...ys);
  const lo = Math.min(...ys);
  const pad = (hi - lo) * 0.04 || 1;
  const yMax = hi + pad;
  const yMin = lo - pad;
  const range = yMax - yMin || 1;
  const y = (p: number) => padT + ((yMax - p) / range) * (h - padT - padB);

  const lineDefs: Array<{ key: string; value: any; color: string; dash?: string }> = levels
    ? [
        { key: "RES", value: levels.resistance, color: T.warn, dash: "4 3" },
        { key: "SUP", value: levels.support, color: T.warn, dash: "4 3" },
        { key: "ENT", value: levels.entry, color: T.acc, dash: "2 2" },
        { key: "SL", value: levels.sl, color: T.sell },
        { key: "TP1", value: levels.tp1, color: T.buy, dash: "2 2" },
        { key: "TP2", value: levels.tp2, color: T.buy, dash: "1 3" },
        { key: "VWAP", value: levels.vwap, color: T.bid, dash: "3 3" },
        { key: "POC", value: levels.poc, color: "#a78bfa", dash: "4 2" },
        { key: "VAH", value: levels.vah, color: "#a78bfa", dash: "1 3" },
        { key: "VAL", value: levels.val, color: "#a78bfa", dash: "1 3" },
        { key: "SHi", value: levels.session_high, color: T.faint, dash: "2 4" },
        { key: "SLo", value: levels.session_low, color: T.faint, dash: "2 4" },
      ]
    : [];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ display: "block" }}>
      {/* candles */}
      {candles.map((c, i) => {
        const x = padL + i * cw + cw / 2;
        const up = c.close >= c.open;
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        const color = up ? T.buy : T.sell;
        return (
          <g key={c.id}>
            <title>{`${c.candle_time}  O:${c.open} H:${c.high} L:${c.low} C:${c.close}`}</title>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="0.6" />
            <rect
              x={x - cw / 2.6}
              y={top}
              width={Math.max(0.5, cw / 1.3)}
              height={Math.max(1, bot - top)}
              fill={color}
              stroke={color}
              strokeWidth="0.4"
            />
          </g>
        );
      })}
      {/* level lines (only those with a value) */}
      {lineDefs.map((l) => {
        const n = Number(l.value);
        if (!Number.isFinite(n) || n <= 0) return null;
        const ly = y(n);
        return (
          <g key={l.key}>
            <line x1={padL} x2={w - padR} y1={ly} y2={ly} stroke={l.color} strokeWidth="0.8" strokeDasharray={l.dash} opacity="0.85" />
            <text x={w - padR + 4} y={ly + 3} fontSize="8.5" fill={l.color} fontFamily="JetBrains Mono, monospace">
              {l.key} {n.toLocaleString(undefined, { maximumFractionDigits: 5 })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Overlay({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1"
      style={{
        height: 240,
        color: T.dim,
        fontFamily: "Archivo, sans-serif",
        background: T.panel2,
        border: `1px dashed ${T.line}`,
        borderRadius: 4,
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: T.warn }}>{label}</div>
      {sub && <div className="text-[10px]" style={{ color: T.faint }}>{sub}</div>}
    </div>
  );
}
