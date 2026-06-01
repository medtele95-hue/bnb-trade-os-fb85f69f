import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Waiting } from "./Waiting";
import { sanitizeCandles, fmtTime, type RawCandle } from "@/lib/candles";

type Props = {
  symbol?: string;
  timeframe?: string;
  variant?: "mini" | "main";
};

export function CandleChart({
  symbol = "BTCUSD",
  timeframe = "M5",
  variant = "mini",
}: Props) {
  const visibleLimit = variant === "main" ? 150 : 80;
  // Pull a bit more than visible to allow dedupe/filter without empty space
  const fetchLimit = visibleLimit * 2;
  const [raw, setRaw] = useState<RawCandle[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("market_candles" as any)
        .select("*")
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .order("candle_time", { ascending: false })
        .limit(fetchLimit);
      if (cancelled) return;
      setRaw((data ?? []) as unknown as RawCandle[]);
    };
    load();
    const ch = supabase
      .channel(`live:market_candles:${symbol}:${timeframe}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_candles", filter: `symbol=eq.${symbol}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [symbol, timeframe, fetchLimit]);

  const { candles, diagnostics } = useMemo(
    () => sanitizeCandles(raw, { limit: visibleLimit, timeframe }),
    [raw, visibleLimit, timeframe],
  );

  if (raw === null) {
    return <Waiting label="LOADING CANDLES" />;
  }
  if (candles.length === 0) {
    return <Waiting label="WAITING FOR LIVE CANDLES" />;
  }

  const w = 900;
  const h = variant === "main" ? 320 : 240;
  const padL = 50;
  const padR = 60;
  const padT = 12;
  const padB = 20;
  const cw = (w - padL - padR) / candles.length;
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const hi = Math.max(...highs);
  const lo = Math.min(...lows);
  const pad = (hi - lo) * 0.04 || 1;
  const yMax = hi + pad;
  const yMin = lo - pad;
  const range = yMax - yMin || 1;
  const y = (p: number) => padT + ((yMax - p) / range) * (h - padT - padB);

  const support = yMin + (yMax - yMin) * 0.15;
  const resistance = yMin + (yMax - yMin) * 0.85;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full tick" preserveAspectRatio="none">
        {[
          { p: support, label: "SUPPORT" },
          { p: resistance, label: "RESISTANCE" },
        ].map((l, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={y(l.p)}
              y2={y(l.p)}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="6 4"
            />
            <text x={w - padR + 4} y={y(l.p) + 3} fontSize="9" fill="currentColor" fontFamily="monospace">
              {l.label}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const x = padL + i * cw + cw / 2;
          const up = c.close >= c.open;
          const top = y(Math.max(c.open, c.close));
          const bot = y(Math.min(c.open, c.close));
          return (
            <g key={c.id}>
              <title>{`${c.candle_time}  O:${c.open} H:${c.high} L:${c.low} C:${c.close}`}</title>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke="black" strokeWidth="0.7" />
              <rect
                x={x - cw / 2.6}
                y={top}
                width={cw / 1.3}
                height={Math.max(1, bot - top)}
                fill={up ? "white" : "black"}
                stroke="black"
                strokeWidth="0.7"
              />
            </g>
          );
        })}

        {diagnostics.gaps_detected > 0 && (
          <text x={padL + 4} y={padT + 10} fontSize="9" fill="#b91c1c" fontFamily="monospace" className="font-bold">
            ⚠ DATA GAP DETECTED ({diagnostics.gaps_detected})
          </text>
        )}
      </svg>
      <div className="mt-1 text-[9px] uppercase tracking-wider opacity-70 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
        <span>loaded:{diagnostics.candles_loaded}</span>
        <span>visible:{diagnostics.visible_candles}</span>
        <span>dup-removed:{diagnostics.duplicate_candles_removed}</span>
        <span>invalid:{diagnostics.invalid_removed}</span>
        <span>gaps:{diagnostics.gaps_detected}</span>
        <span>first:{fmtTime(diagnostics.first_visible_time)}</span>
        <span>last:{fmtTime(diagnostics.last_visible_time)}</span>
      </div>
    </div>
  );
}
