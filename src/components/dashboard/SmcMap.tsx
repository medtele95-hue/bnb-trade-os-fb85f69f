import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { Waiting } from "@/components/dashboard/Waiting";
import { useLiveTable } from "@/hooks/useLiveTable";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { sanitizeCandles, fmtTime, type CandleDiagnostics, type RawCandle } from "@/lib/candles";


const SYMBOLS = ["BTCUSD", "GOLD#", "EURUSD"] as const;
const TIMEFRAMES = ["M5", "M15", "H1", "H4"] as const;
type Symbol = (typeof SYMBOLS)[number];
type Timeframe = (typeof TIMEFRAMES)[number];

const SYMBOL_ALIASES: Record<Symbol, string[]> = {
  BTCUSD: ["BTCUSD", "BTCUSDT", "BTC"],
  "GOLD#": ["GOLD#", "GOLD", "XAUUSD", "XAU"],
  EURUSD: ["EURUSD"],
};

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

function getField(raw: any, key: string): any {
  if (!raw) return undefined;
  if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  const nested = raw.raw_payload;
  if (nested && typeof nested === "object") {
    if (nested[key] !== undefined && nested[key] !== null) return nested[key];
    for (const group of ["smc_confluence", "mtfa", "mtf_structure"]) {
      const g = nested[group];
      if (g && typeof g === "object" && g[key] !== undefined && g[key] !== null) return g[key];
    }
  }
  for (const group of ["smc_confluence", "mtfa", "mtf_structure"]) {
    const g = raw[group];
    if (g && typeof g === "object" && g[key] !== undefined && g[key] !== null) return g[key];
  }
  return undefined;
}

function num(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v: any): string {
  if (v === undefined || v === null || v === "") return "UNKNOWN";
  if (typeof v === "boolean") return v ? "YES" : "NO";
  return String(v);
}

function matchSymbol(rowSymbol: any, target: Symbol): boolean {
  if (!rowSymbol) return false;
  const s = String(rowSymbol).toUpperCase();
  return SYMBOL_ALIASES[target].some((a) => s.includes(a.toUpperCase().replace("#", "")));
}

function useCandles(symbol: Symbol, timeframe: Timeframe, limit = 150) {
  const [raw, setRaw] = useState<RawCandle[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const aliases = SYMBOL_ALIASES[symbol];

    const load = async () => {
      const { data } = await supabase
        .from("market_candles" as any)
        .select("*")
        .in("symbol", aliases)
        .eq("timeframe", timeframe)
        .order("candle_time", { ascending: false })
        .limit(limit * 2);
      if (cancelled) return;
      setRaw((data ?? []) as unknown as RawCandle[]);
    };
    load();

    const ch = supabase
      .channel(`smc-candles:${symbol}:${timeframe}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_candles" },
        (payload: any) => {
          const sym = payload?.new?.symbol ?? payload?.old?.symbol;
          const tf = payload?.new?.timeframe ?? payload?.old?.timeframe;
          if (tf === timeframe && aliases.some((a) => String(sym ?? "").toUpperCase().includes(a.toUpperCase().replace("#", "")))) {
            load();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [symbol, timeframe, limit]);

  const result = useMemo(
    () => sanitizeCandles(raw, { limit, timeframe }),
    [raw, limit, timeframe],
  );
  return { candles: result.candles, diagnostics: result.diagnostics, loading: raw === null };
}


function formatPrice(p: number): string {
  if (Math.abs(p) >= 1000) return p.toFixed(2);
  if (Math.abs(p) >= 10) return p.toFixed(3);
  return p.toFixed(5);
}

type Level = { price: number; label: string; color: string; dashed?: boolean };
type Zone = { top: number; bottom: number; label: string; fill: string; stroke: string };

function SmcChart({ candles, raw }: { candles: Candle[]; raw: any }) {
  const entry = num(getField(raw, "entry"));
  const sl = num(getField(raw, "sl"));
  const tp = num(getField(raw, "tp"));
  const supply = num(getField(raw, "h4_supply_zone"));
  const demand = num(getField(raw, "h4_demand_zone"));
  const support = num(getField(raw, "h4_recent_support"));
  const resistance = num(getField(raw, "h4_recent_resistance"));
  const dir = String(getField(raw, "direction") ?? getField(raw, "signal") ?? "WAIT").toUpperCase();
  const liqType = getField(raw, "m15_liquidity_type");
  const hasFvg = getField(raw, "smc_h1_fvg");
  const hasOb = getField(raw, "smc_h1_order_block");

  const w = 1000;
  const h = 360;
  const padL = 8;
  const padR = 110;
  const padT = 16;
  const padB = 26;

  const highs = candles.map((c) => Number(c.high));
  const lows = candles.map((c) => Number(c.low));
  const lastClose = Number(candles[candles.length - 1]?.close ?? 0);

  // Build overlay set
  const extraPrices = [entry, sl, tp, supply, demand, support, resistance].filter((p): p is number => p !== null);
  const allHigh = Math.max(...highs, ...extraPrices);
  const allLow = Math.min(...lows, ...extraPrices);
  const pad = (allHigh - allLow) * 0.05 || 1;
  const yMax = allHigh + pad;
  const yMin = allLow - pad;
  const range = yMax - yMin || 1;
  const y = (p: number) => padT + ((yMax - p) / range) * (h - padT - padB);

  const cw = (w - padL - padR) / Math.max(candles.length, 1);

  // Build zones
  const zones: Zone[] = [];
  if (supply !== null) {
    const top = supply * 1.001;
    const bot = supply * 0.999;
    zones.push({ top, bottom: bot, label: "H4 SUPPLY", fill: "rgba(220, 38, 38, 0.18)", stroke: "rgba(220,38,38,0.6)" });
  }
  if (demand !== null) {
    const top = demand * 1.001;
    const bot = demand * 0.999;
    zones.push({ top, bottom: bot, label: "H4 DEMAND", fill: "rgba(22, 163, 74, 0.18)", stroke: "rgba(22,163,74,0.6)" });
  }
  // FVG zone (approximate using last 3 candles gap if available)
  if (hasFvg && hasFvg !== "NONE" && candles.length >= 3) {
    const last3 = candles.slice(-3);
    const upperGap = Math.min(Number(last3[0].high), Number(last3[2].high));
    const lowerGap = Math.max(Number(last3[0].low), Number(last3[2].low));
    if (upperGap > lowerGap) {
      zones.push({ top: upperGap, bottom: lowerGap, label: `FVG ${hasFvg}`, fill: "rgba(139, 92, 246, 0.18)", stroke: "rgba(139,92,246,0.7)" });
    }
  }
  // OB zone (approximate using last bullish/bearish candle body)
  if (hasOb && hasOb !== "NONE" && candles.length >= 2) {
    const bullish = String(hasOb).toUpperCase().includes("BULL");
    // Find most recent opposite-direction candle (OB is usually last opposite candle before move)
    let obCandle: Candle | null = null;
    for (let i = candles.length - 2; i >= Math.max(0, candles.length - 20); i--) {
      const c = candles[i];
      const up = Number(c.close) > Number(c.open);
      if (bullish ? !up : up) {
        obCandle = c;
        break;
      }
    }
    if (obCandle) {
      const top = Math.max(Number(obCandle.open), Number(obCandle.close));
      const bot = Math.min(Number(obCandle.open), Number(obCandle.close));
      zones.push({ top, bottom: bot, label: `OB ${hasOb}`, fill: "rgba(251, 146, 60, 0.20)", stroke: "rgba(234,88,12,0.7)" });
    }
  }
  // OTE zone (0.618 - 0.786 between SL and TP, or recent swing)
  if (entry !== null && sl !== null && tp !== null) {
    const swingLow = Math.min(sl, tp);
    const swingHigh = Math.max(sl, tp);
    const r = swingHigh - swingLow;
    const oteTop = swingLow + r * (1 - 0.618);
    const oteBot = swingLow + r * (1 - 0.786);
    const top = Math.max(oteTop, oteBot);
    const bot = Math.min(oteTop, oteBot);
    zones.push({ top, bottom: bot, label: "OTE 0.618-0.786", fill: "rgba(59, 130, 246, 0.15)", stroke: "rgba(37,99,235,0.6)" });
  }

  const levels: Level[] = [
    entry !== null && { price: entry, label: "ENTRY", color: "#000" },
    sl !== null && { price: sl, label: "SL", color: "#dc2626" },
    tp !== null && { price: tp, label: "TP", color: "#16a34a" },
    support !== null && { price: support, label: "H4 SUPPORT", color: "#15803d", dashed: true },
    resistance !== null && { price: resistance, label: "H4 RESIST", color: "#b91c1c", dashed: true },
    liqType && { price: lastClose, label: `LIQUIDITY ${liqType}`, color: "#7c3aed", dashed: true },
  ].filter(Boolean) as Level[];

  const arrowX = padL + candles.length * cw + 12;
  const arrowY = entry !== null ? y(entry) : y(lastClose);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ background: "var(--background, #f5f0e0)" }}>
      {/* Grid */}
      {[0.2, 0.4, 0.6, 0.8].map((g) => {
        const yy = padT + g * (h - padT - padB);
        return <line key={g} x1={padL} x2={w - padR} y1={yy} y2={yy} stroke="rgba(0,0,0,0.08)" strokeDasharray="2 3" />;
      })}

      {/* Zones */}
      {zones.map((z, i) => {
        const yTop = y(z.top);
        const yBot = y(z.bottom);
        return (
          <g key={`z${i}`}>
            <rect x={padL} y={Math.min(yTop, yBot)} width={w - padL - padR} height={Math.abs(yBot - yTop) || 2} fill={z.fill} stroke={z.stroke} strokeWidth={0.8} />
            <text x={padL + 4} y={Math.min(yTop, yBot) + 10} fontSize={9} fill={z.stroke} className="uppercase font-bold">{z.label}</text>
          </g>
        );
      })}

      {/* Candles */}
      {candles.map((c, i) => {
        const x = padL + i * cw + cw / 2;
        const o = Number(c.open);
        const cl = Number(c.close);
        const hi = Number(c.high);
        const lo = Number(c.low);
        const up = cl >= o;
        const color = up ? "#16a34a" : "#dc2626";
        const bodyTop = y(Math.max(o, cl));
        const bodyBot = y(Math.min(o, cl));
        const bw = Math.max(1, cw * 0.7);
        return (
          <g key={c.id ?? i}>
            <line x1={x} x2={x} y1={y(hi)} y2={y(lo)} stroke={color} strokeWidth={0.8} />
            <rect x={x - bw / 2} y={bodyTop} width={bw} height={Math.max(1, bodyBot - bodyTop)} fill={up ? color : color} stroke="#000" strokeWidth={0.4} />
          </g>
        );
      })}

      {/* Horizontal levels */}
      {levels.map((lv, i) => {
        const yy = y(lv.price);
        return (
          <g key={`lv${i}`}>
            <line x1={padL} x2={w - padR} y1={yy} y2={yy} stroke={lv.color} strokeWidth={1} strokeDasharray={lv.dashed ? "4 3" : undefined} />
            <rect x={w - padR + 2} y={yy - 7} width={padR - 4} height={14} fill={lv.color} />
            <text x={w - padR + 5} y={yy + 3} fontSize={9} fill="#fff" className="font-bold uppercase">
              {lv.label} {formatPrice(lv.price)}
            </text>
          </g>
        );
      })}

      {/* Direction arrow */}
      {dir.includes("BUY") || dir === "LONG" ? (
        <g transform={`translate(${arrowX - 100}, ${arrowY})`}>
          <polygon points="0,-8 12,0 0,8 4,0" fill="#16a34a" stroke="#000" />
          <text x={18} y={4} fontSize={11} fill="#16a34a" className="font-bold">BUY</text>
        </g>
      ) : dir.includes("SELL") || dir === "SHORT" ? (
        <g transform={`translate(${arrowX - 100}, ${arrowY})`}>
          <polygon points="0,-8 12,0 0,8 4,0" fill="#dc2626" stroke="#000" transform="rotate(180)" />
          <text x={18} y={4} fontSize={11} fill="#dc2626" className="font-bold">SELL</text>
        </g>
      ) : (
        <g transform={`translate(${arrowX - 100}, ${arrowY})`}>
          <rect x={-2} y={-7} width={14} height={14} fill="#000" />
          <text x={18} y={4} fontSize={11} fill="#000" className="font-bold">WAIT</text>
        </g>
      )}
    </svg>
  );
}

function FallbackMap({ raw }: { raw: any }) {
  const entry = num(getField(raw, "entry"));
  const sl = num(getField(raw, "sl"));
  const tp = num(getField(raw, "tp"));
  const supply = num(getField(raw, "h4_supply_zone"));
  const demand = num(getField(raw, "h4_demand_zone"));
  const support = num(getField(raw, "h4_recent_support"));
  const resistance = num(getField(raw, "h4_recent_resistance"));

  const items = [
    supply !== null && { p: supply, label: "H4 SUPPLY", color: "#dc2626" },
    resistance !== null && { p: resistance, label: "H4 RESISTANCE", color: "#b91c1c" },
    tp !== null && { p: tp, label: "TP", color: "#16a34a" },
    entry !== null && { p: entry, label: "ENTRY", color: "#000" },
    sl !== null && { p: sl, label: "SL", color: "#dc2626" },
    support !== null && { p: support, label: "H4 SUPPORT", color: "#15803d" },
    demand !== null && { p: demand, label: "H4 DEMAND", color: "#16a34a" },
  ].filter(Boolean) as Array<{ p: number; label: string; color: string }>;

  if (items.length === 0) {
    return <div className="p-6 text-center text-[11px] opacity-70">No SMC levels available — waiting for candles & raw_payload.</div>;
  }
  const max = Math.max(...items.map((i) => i.p));
  const min = Math.min(...items.map((i) => i.p));
  const sorted = [...items].sort((a, b) => b.p - a.p);
  const w = 1000, h = 320, padT = 20, padB = 20, padL = 80, padR = 140;
  const range = max - min || 1;
  const y = (p: number) => padT + ((max - p) / range) * (h - padT - padB);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <text x={padL} y={14} fontSize={10} className="uppercase font-bold">FALLBACK PRICE MAP — No live candles</text>
      {sorted.map((it, i) => {
        const yy = y(it.p);
        return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={yy} y2={yy} stroke={it.color} strokeWidth={1.2} strokeDasharray="4 3" />
            <rect x={w - padR + 2} y={yy - 8} width={padR - 4} height={16} fill={it.color} />
            <text x={w - padR + 5} y={yy + 4} fontSize={10} fill="#fff" className="font-bold uppercase">
              {it.label} {formatPrice(it.p)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Checklist({ raw }: { raw: any }) {
  const items: Array<[string, boolean | undefined]> = [
    ["H4 direction clear", (() => { const v = getField(raw, "smc_h4_direction"); return v ? v !== "NONE" && v !== "RANGE" && v !== "UNKNOWN" : undefined; })()],
    ["H1 trend clear", (() => { const v = getField(raw, "smc_h1_trend"); return v ? v !== "NEUTRAL" && v !== "NONE" : undefined; })()],
    ["BOS/CHoCH", (() => { const v = getField(raw, "smc_h1_break_structure"); return v ? v !== "NONE" : undefined; })()],
    ["OB/FVG", (() => {
      const ob = getField(raw, "smc_h1_order_block");
      const fvg = getField(raw, "smc_h1_fvg");
      if (ob === undefined && fvg === undefined) return undefined;
      return (ob && ob !== "NONE") || (fvg && fvg !== "NONE");
    })()],
    ["Liquidity", (() => { const v = getField(raw, "smc_h1_liquidity"); return v ? v !== "NONE" : undefined; })()],
    ["M15 confirm", getField(raw, "smc_m15_confirmation") === true ? true : getField(raw, "smc_m15_confirmation") === false ? false : undefined],
    ["M5 confirm", getField(raw, "smc_m5_confirmation") === true ? true : getField(raw, "smc_m5_confirmation") === false ? false : undefined],
    ["M1 entry", getField(raw, "smc_m1_entry_confirmation") === true ? true : getField(raw, "smc_m1_entry_confirmation") === false ? false : undefined],
    ["Spread OK", (() => { const v = num(getField(raw, "spread")); if (v === null) return undefined; return v < 50; })()],
    ["Risk OK", (() => { const rs = getField(raw, "risk_status"); if (!rs) return undefined; return String(rs).toUpperCase() !== "BLOCKED"; })()],
  ];
  return (
    <div className="grid grid-cols-5 gap-x-3 gap-y-1">
      {items.map(([k, ok]) => (
        <div key={k} className="flex items-center gap-1 text-[10px]">
          <span className={cn(
            "inline-block w-3 h-3 border border-black text-center leading-[10px] text-[9px] font-bold",
            ok === true && "bg-foreground text-background",
            ok === false && "bg-background text-loss",
          )}>
            {ok === true ? "✓" : ok === false ? "×" : "?"}
          </span>
          <span className="opacity-80 uppercase tracking-wider">{k}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div className="border border-black p-2">
      <div className="text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className={cn("pixel text-[13px] truncate", accent)}>{fmt(value)}</div>
    </div>
  );
}

export function SmcMap() {
  const { rows: decisions, empty } = useLiveTable<any>("ai_decisions", { limit: 60 });

  // Find latest active symbol
  const latestSymbol = useMemo<Symbol>(() => {
    for (const r of decisions) {
      for (const s of SYMBOLS) if (matchSymbol(r.symbol, s)) return s;
    }
    return "BTCUSD";
  }, [decisions]);

  const [symbol, setSymbol] = useState<Symbol>("BTCUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("M5");
  const [autoSym, setAutoSym] = useState(true);
  const activeSymbol = autoSym ? latestSymbol : symbol;

  const candles = useCandles(activeSymbol, timeframe, 150);

  const raw = useMemo(() => {
    const found = decisions.find((r) => matchSymbol(r.symbol, activeSymbol));
    if (!found) return null;
    return { ...found, ...(found.raw_payload ?? {}) };
  }, [decisions, activeSymbol]);

  const tableRows = useMemo(() => {
    return decisions.slice(0, 8).map((r) => {
      const merged = { ...r, ...(r.raw_payload ?? {}) };
      return {
        id: r.id,
        time: r.created_at,
        symbol: r.symbol ?? "—",
        direction: getField(merged, "direction") ?? getField(merged, "signal") ?? "—",
        score: getField(merged, "smc_confluence_score"),
        status: getField(merged, "smc_confluence_status"),
        reason: getField(merged, "smc_confluence_reason"),
        mtfa: getField(merged, "mtfa_status"),
        mtf_structure: getField(merged, "mtf_structure_status"),
      };
    });
  }, [decisions]);

  return (
    <Panel title="SMC MAP / TRADINGVIEW PLAN" right="OBSERVER ONLY · VISUAL">
      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black pb-2 mb-2">
        <div className="text-[10px] uppercase tracking-wider opacity-70">Symbol</div>
        <div className="flex">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => { setSymbol(s); setAutoSym(false); }}
              className={cn(
                "border border-black px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold -ml-px first:ml-0",
                !autoSym && symbol === s ? "bg-foreground text-background" : "bg-background hover:bg-foreground hover:text-background"
              )}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setAutoSym(true)}
            className={cn(
              "border border-black px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold -ml-px",
              autoSym ? "bg-foreground text-background" : "bg-background hover:bg-foreground hover:text-background"
            )}
          >
            AUTO ({latestSymbol})
          </button>
        </div>
        <div className="text-[10px] uppercase tracking-wider opacity-70 ml-3">TF</div>
        <div className="flex">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={cn(
                "border border-black px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold -ml-px first:ml-0",
                timeframe === t ? "bg-foreground text-background" : "bg-background hover:bg-foreground hover:text-background"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[10px] uppercase tracking-wider opacity-70">
          ACTIVE: <b>{activeSymbol}</b> · <b>{timeframe}</b>
        </div>
      </div>

      {/* Chart */}
      <div className="border border-black bg-background">
        {candles === null ? (
          <div className="p-6"><Waiting label="LOADING CANDLES" /></div>
        ) : candles.length === 0 ? (
          <FallbackMap raw={raw} />
        ) : (
          <SmcChart candles={candles} raw={raw} />
        )}
      </div>

      {/* Checklist */}
      <div className="mt-2 border border-dashed border-black/50 p-2">
        <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Confluence Checklist</div>
        <Checklist raw={raw} />
      </div>

      {/* Summary cards (compact, secondary) */}
      <div className="grid grid-cols-6 gap-2 mt-2">
        <SummaryCard label="SMC Score" value={getField(raw, "smc_confluence_score")} />
        <SummaryCard label="SMC Status" value={getField(raw, "smc_confluence_status")} />
        <SummaryCard label="H4 Direction" value={getField(raw, "smc_h4_direction")} />
        <SummaryCard label="H1 Trend" value={getField(raw, "smc_h1_trend")} />
        <SummaryCard label="M15 Confirm" value={getField(raw, "smc_m15_confirmation")} />
        <SummaryCard label="Direction" value={getField(raw, "direction") ?? getField(raw, "signal")} />
      </div>
      <div className="mt-1 text-[10px] italic opacity-80 truncate">
        <b>REASON:</b> {fmt(getField(raw, "smc_confluence_reason"))}
      </div>

      {/* Compact table */}
      <div className="mt-3 border-t border-black pt-1">
        <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Latest SMC Decisions</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black text-left uppercase tracking-wider">
                <th className="py-0.5 pr-2">Time</th>
                <th className="pr-2">Sym</th>
                <th className="pr-2">Dir</th>
                <th className="pr-2">Score</th>
                <th className="pr-2">Status</th>
                <th className="pr-2">MTFA</th>
                <th className="pr-2">MTF Struct</th>
                <th className="pr-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {empty ? (
                <tr><td colSpan={8} className="py-1 opacity-60">No decisions yet</td></tr>
              ) : tableRows.map((t) => (
                <tr key={t.id} className="border-b border-dashed border-black/40">
                  <td className="py-0.5 pr-2 pixel">{t.time ? new Date(t.time).toISOString().slice(11, 19) : "—"}</td>
                  <td className="pr-2">{t.symbol}</td>
                  <td className="pr-2">{fmt(t.direction)}</td>
                  <td className="pr-2 pixel">{t.score ?? "—"}</td>
                  <td className="pr-2">{fmt(t.status)}</td>
                  <td className="pr-2">{fmt(t.mtfa)}</td>
                  <td className="pr-2">{fmt(t.mtf_structure)}</td>
                  <td className="pr-2 italic opacity-80 max-w-[260px] truncate">{fmt(t.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-2 border border-dashed border-black/60 p-2 text-[10px] uppercase tracking-widest text-center">
        ⚠ SMC Visual Map is observational only. It does not approve, block, or execute trades.
      </div>
    </Panel>
  );
}
