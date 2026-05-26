import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Waiting } from "./Waiting";

type Candle = {
  id: string;
  symbol: string;
  timeframe: string;
  candle_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type Props = {
  symbol?: string;
  timeframe?: string;
  limit?: number;
};

export function CandleChart({ symbol = "BTCUSD", timeframe = "M5", limit = 80 }: Props) {
  const [candles, setCandles] = useState<Candle[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("market_candles" as any)
        .select("*")
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .order("candle_time", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      const rows = ((data ?? []) as unknown as Candle[]).slice().reverse();
      setCandles(rows);
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
  }, [symbol, timeframe, limit]);

  if (candles === null) {
    return <Waiting label="LOADING CANDLES" />;
  }
  if (candles.length === 0) {
    return <Waiting label="WAITING FOR LIVE CANDLES" />;
  }

  const w = 900;
  const h = 280;
  const padL = 50;
  const padR = 60;
  const padT = 12;
  const padB = 20;
  const cw = (w - padL - padR) / candles.length;
  const allHigh = Math.max(...candles.map((c) => Number(c.high)));
  const allLow = Math.min(...candles.map((c) => Number(c.low)));
  const range = allHigh - allLow || 1;
  const y = (p: number) => padT + ((allHigh - p) / range) * (h - padT - padB);

  const support = allLow + range * 0.15;
  const resistance = allLow + range * 0.85;

  return (
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
          <text
            x={w - padR + 4}
            y={y(l.p) + 3}
            fontSize="9"
            fill="currentColor"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        </g>
      ))}

      {candles.map((c, i) => {
        const x = padL + i * cw + cw / 2;
        const o = Number(c.open);
        const cl = Number(c.close);
        const hi = Number(c.high);
        const lo = Number(c.low);
        const up = cl >= o;
        const top = y(Math.max(o, cl));
        const bot = y(Math.min(o, cl));
        return (
          <g key={c.id}>
            <line x1={x} x2={x} y1={y(hi)} y2={y(lo)} stroke="black" strokeWidth="0.7" />
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
    </svg>
  );
}
