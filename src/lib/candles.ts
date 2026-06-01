// Frontend-only candle sanitization helpers. Read-only, no trading logic.

export type RawCandle = {
  id?: string;
  symbol?: string;
  timeframe?: string;
  candle_time?: string | null;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  [k: string]: any;
};

export type CleanCandle = {
  id: string;
  symbol: string;
  timeframe: string;
  candle_time: string;
  candle_time_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type CandleDiagnostics = {
  candles_loaded: number;
  visible_candles: number;
  first_visible_time: string | null;
  last_visible_time: string | null;
  gaps_detected: number;
  duplicate_candles_removed: number;
  invalid_removed: number;
};

const TF_MS: Record<string, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
};

export function timeframeMs(tf?: string): number {
  if (!tf) return 0;
  return TF_MS[tf.toUpperCase()] ?? 0;
}

export function sanitizeCandles(
  raw: RawCandle[] | null | undefined,
  opts: { limit: number; timeframe?: string },
): { candles: CleanCandle[]; diagnostics: CandleDiagnostics } {
  const input = raw ?? [];
  const loaded = input.length;

  // Filter invalid candles
  let invalid = 0;
  const valid: CleanCandle[] = [];
  for (const r of input) {
    const t = r.candle_time;
    const o = Number(r.open);
    const h = Number(r.high);
    const l = Number(r.low);
    const c = Number(r.close);
    if (!t) { invalid++; continue; }
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) { invalid++; continue; }
    if (![o, h, l, c].every((v) => Number.isFinite(v))) { invalid++; continue; }
    if (o === 0 || h === 0 || l === 0 || c === 0) { invalid++; continue; }
    if (h < l) { invalid++; continue; }
    valid.push({
      id: String(r.id ?? `${r.symbol}-${r.timeframe}-${t}`),
      symbol: String(r.symbol ?? ""),
      timeframe: String(r.timeframe ?? ""),
      candle_time: t,
      candle_time_ms: ms,
      open: o, high: h, low: l, close: c,
    });
  }

  // Dedupe by symbol+timeframe+candle_time
  const seen = new Map<string, CleanCandle>();
  for (const c of valid) {
    const key = `${c.symbol}|${c.timeframe}|${c.candle_time}`;
    seen.set(key, c); // keep last
  }
  const deduped = Array.from(seen.values());
  const duplicates_removed = valid.length - deduped.length;

  // Sort ascending by time
  deduped.sort((a, b) => a.candle_time_ms - b.candle_time_ms);

  // Limit to latest N
  const visible = deduped.slice(-opts.limit);

  // Count gaps
  let gaps = 0;
  const tfMs = timeframeMs(opts.timeframe);
  if (tfMs > 0 && visible.length >= 2) {
    for (let i = 1; i < visible.length; i++) {
      const delta = visible[i].candle_time_ms - visible[i - 1].candle_time_ms;
      if (delta > tfMs * 2) gaps++;
    }
  }

  return {
    candles: visible,
    diagnostics: {
      candles_loaded: loaded,
      visible_candles: visible.length,
      first_visible_time: visible[0]?.candle_time ?? null,
      last_visible_time: visible[visible.length - 1]?.candle_time ?? null,
      gaps_detected: gaps,
      duplicate_candles_removed: duplicates_removed,
      invalid_removed: invalid,
    },
  };
}

export function fmtTime(t: string | null): string {
  if (!t) return "—";
  return t.replace("T", " ").slice(0, 19);
}
