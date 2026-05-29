import { useMemo } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { Waiting } from "@/components/dashboard/Waiting";
import { useLiveTable } from "@/hooks/useLiveTable";
import { cn } from "@/lib/utils";

const SYMBOLS = ["BTCUSD", "GOLD#", "EURUSD"] as const;
const SYMBOL_ALIASES: Record<string, string[]> = {
  BTCUSD: ["BTCUSD", "BTCUSDT", "BTC", "BITCOIN"],
  "GOLD#": ["GOLD#", "GOLD", "XAUUSD", "XAU"],
  EURUSD: ["EURUSD", "EUR"],
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

function fmt(v: any): string {
  if (v === undefined || v === null || v === "") return "UNKNOWN";
  if (typeof v === "boolean") return v ? "YES" : "NO";
  return String(v);
}

function num(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function matchSymbol(rowSymbol: any, target: string): boolean {
  if (!rowSymbol) return false;
  const s = String(rowSymbol).toUpperCase();
  return SYMBOL_ALIASES[target].some((a) => s.includes(a.toUpperCase().replace("#", "")));
}

function Badge({ label, state }: { label: string; state: "ACTIVE" | "OFF" | "UNKNOWN" }) {
  const cls =
    state === "ACTIVE"
      ? "bg-foreground text-background"
      : state === "OFF"
      ? "bg-background text-foreground opacity-60"
      : "bg-background text-foreground opacity-40 border-dashed";
  return (
    <span className={cn("inline-block border border-black px-1.5 py-0.5 text-[9px] uppercase tracking-wider mr-1 mb-1", cls)}>
      {label}: {state}
    </span>
  );
}

function badgeState(v: any): "ACTIVE" | "OFF" | "UNKNOWN" {
  if (v === true) return "ACTIVE";
  if (v === false) return "OFF";
  return "UNKNOWN";
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-baseline justify-between gap-1 border-b border-dashed border-black/30 py-0.5">
      <span className="uppercase tracking-wider text-[9px] opacity-70">{k}</span>
      <span className="pixel text-[10px] truncate max-w-[60%] text-right">{fmt(v)}</span>
    </div>
  );
}

function PriceLadder({ raw }: { raw: any }) {
  const entry = num(getField(raw, "entry"));
  const sl = num(getField(raw, "sl"));
  const tp = num(getField(raw, "tp"));
  const supply = num(getField(raw, "h4_supply_zone"));
  const demand = num(getField(raw, "h4_demand_zone"));
  const support = num(getField(raw, "h4_recent_support"));
  const resistance = num(getField(raw, "h4_recent_resistance"));
  const dir = String(getField(raw, "direction") ?? getField(raw, "signal") ?? "WAIT").toUpperCase();
  const arrow = dir.includes("BUY") || dir === "LONG" ? "▲ BUY" : dir.includes("SELL") || dir === "SHORT" ? "▼ SELL" : "■ WAIT";
  const liqType = getField(raw, "m15_liquidity_type");

  const levels = [
    { k: "H4 SUPPLY", v: supply, cls: "text-loss" },
    { k: "RESISTANCE", v: resistance, cls: "text-loss opacity-80" },
    { k: "TP", v: tp, cls: "text-profit" },
    { k: "ENTRY", v: entry, cls: "font-bold" },
    { k: "SL", v: sl, cls: "text-loss" },
    { k: "SUPPORT", v: support, cls: "text-profit opacity-80" },
    { k: "H4 DEMAND", v: demand, cls: "text-profit" },
  ]
    .filter((l) => l.v !== null)
    .sort((a, b) => (b.v as number) - (a.v as number));

  return (
    <div className="mt-1 border border-black p-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
        <span className="font-bold">PRICE MAP</span>
        <span className="pixel">{arrow}</span>
      </div>
      {levels.length === 0 ? (
        <div className="text-[10px] opacity-60 italic">No price levels available</div>
      ) : (
        <div className="space-y-0.5">
          {levels.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="uppercase tracking-wider opacity-70 text-[9px]">{l.k}</span>
              <span className={cn("pixel", l.cls)}>{(l.v as number).toFixed(5)}</span>
            </div>
          ))}
        </div>
      )}
      {liqType && (
        <div className="mt-1 text-[9px] opacity-70 uppercase">LIQUIDITY: {fmt(liqType)}</div>
      )}
    </div>
  );
}

function SymbolCard({ symbol, raw }: { symbol: string; raw: any }) {
  const score = num(getField(raw, "smc_confluence_score"));
  const status = getField(raw, "smc_confluence_status");
  const reason = getField(raw, "smc_confluence_reason");

  return (
    <div className="border border-black p-2">
      <div className="flex items-center justify-between border-b border-black pb-1 mb-1">
        <div className="font-bold text-[12px]">{symbol}</div>
        <div className="pixel text-[12px]">
          {score !== null ? `${score}` : "—"}
          <span className="text-[9px] opacity-70 ml-1">{fmt(status)}</span>
        </div>
      </div>
      {!raw ? (
        <div className="text-[10px] opacity-60 italic">No SMC data available for {symbol}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-y-0">
            <Row k="H4 Direction" v={getField(raw, "smc_h4_direction")} />
            <Row k="H1 Trend" v={getField(raw, "smc_h1_trend")} />
            <Row k="H1 BOS/CHoCH" v={getField(raw, "smc_h1_break_structure")} />
            <Row k="H1 OB" v={getField(raw, "smc_h1_order_block")} />
            <Row k="H1 FVG" v={getField(raw, "smc_h1_fvg")} />
            <Row k="H1 Liquidity" v={getField(raw, "smc_h1_liquidity")} />
            <Row k="M15 Confirm" v={getField(raw, "smc_m15_confirmation")} />
            <Row k="M5 Confirm" v={getField(raw, "smc_m5_confirmation")} />
            <Row k="M1 Entry Confirm" v={getField(raw, "smc_m1_entry_confirmation")} />
          </div>
          <div className="mt-1 text-[9px] italic opacity-80 line-clamp-2">"{fmt(reason)}"</div>

          <div className="mt-2 border-t border-dashed border-black/40 pt-1">
            <div className="text-[9px] uppercase opacity-70 mb-1">Setups</div>
            <Badge label="IFVG+OTE" state={badgeState(getField(raw, "ifvg_ote_sniper"))} />
            <Badge label="TURTLE+OTE" state={badgeState(getField(raw, "turtle_soup_ote"))} />
            <Badge label="AMD+BPR+OTE" state={badgeState(getField(raw, "amd_bpr_ote"))} />
            <Badge label="BREAKER+FVG+OTE" state={badgeState(getField(raw, "breaker_fvg_ote"))} />
            <Badge label="EMA50/200+STOCH" state={badgeState(getField(raw, "ema50_200_stoch_confirmation"))} />
          </div>

          <PriceLadder raw={raw} />

          <Checklist raw={raw} />
        </>
      )}
    </div>
  );
}

function Checklist({ raw }: { raw: any }) {
  const items: Array<[string, any]> = [
    ["H4 direction clear", (() => { const v = getField(raw, "smc_h4_direction"); return v && v !== "NONE" && v !== "RANGE" && v !== "UNKNOWN"; })()],
    ["H1 trend clear", (() => { const v = getField(raw, "smc_h1_trend"); return v && v !== "NEUTRAL" && v !== "NONE"; })()],
    ["H1 BOS/CHoCH", (() => { const v = getField(raw, "smc_h1_break_structure"); return v && v !== "NONE"; })()],
    ["OB or FVG", (() => {
      const ob = getField(raw, "smc_h1_order_block");
      const fvg = getField(raw, "smc_h1_fvg");
      return (ob && ob !== "NONE") || (fvg && fvg !== "NONE");
    })()],
    ["Liquidity", (() => { const v = getField(raw, "smc_h1_liquidity"); return v && v !== "NONE"; })()],
    ["M15 confirm", getField(raw, "smc_m15_confirmation") === true],
    ["M5 confirm", getField(raw, "smc_m5_confirmation") === true],
    ["M1 entry confirm", getField(raw, "smc_m1_entry_confirmation") === true],
    ["Spread OK", getField(raw, "spread_ok") !== false],
    ["Risk OK", (() => {
      const rs = getField(raw, "risk_status");
      if (rs === undefined) return undefined;
      return String(rs).toUpperCase() !== "BLOCKED";
    })()],
  ];
  return (
    <div className="mt-2 border-t border-dashed border-black/40 pt-1">
      <div className="text-[9px] uppercase opacity-70 mb-1">Confluence Checklist</div>
      <div className="grid grid-cols-2 gap-x-2">
        {items.map(([k, ok]) => (
          <div key={k} className="flex items-center gap-1 text-[10px]">
            <span className="inline-block w-2.5 h-2.5 border border-black text-center leading-[10px] text-[9px]">
              {ok === true ? "✓" : ok === false ? "×" : "?"}
            </span>
            <span className="opacity-80">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SmcMap() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 60 });

  const perSymbol = useMemo(() => {
    const map: Record<string, any> = {};
    for (const sym of SYMBOLS) {
      const found = rows.find((r) => matchSymbol(r.symbol ?? r.raw_payload?.symbol, sym));
      if (found) {
        const raw = { ...(found.raw_payload ?? {}), ...found, ...(found.raw_payload ?? {}) };
        // Build a merged view: top row + raw_payload
        map[sym] = { ...found, ...(found.raw_payload ?? {}) };
      } else {
        map[sym] = null;
      }
    }
    return map;
  }, [rows]);

  const tableRows = useMemo(() => {
    return rows.slice(0, 10).map((r) => {
      const raw = { ...r, ...(r.raw_payload ?? {}) };
      const setups: string[] = [];
      if (getField(raw, "ifvg_ote_sniper")) setups.push("IFVG+OTE");
      if (getField(raw, "turtle_soup_ote")) setups.push("TURTLE+OTE");
      if (getField(raw, "amd_bpr_ote")) setups.push("AMD+BPR+OTE");
      if (getField(raw, "breaker_fvg_ote")) setups.push("BREAKER+FVG+OTE");
      if (getField(raw, "ema50_200_stoch_confirmation")) setups.push("EMA+STOCH");
      return {
        id: r.id,
        time: r.created_at,
        symbol: r.symbol ?? raw.symbol ?? "—",
        direction: getField(raw, "direction") ?? getField(raw, "signal") ?? "—",
        score: getField(raw, "smc_confluence_score"),
        status: getField(raw, "smc_confluence_status"),
        reason: getField(raw, "smc_confluence_reason"),
        setups: setups.length ? setups.join(", ") : "—",
        mtfa: getField(raw, "mtfa_status"),
        mtf_structure: getField(raw, "mtf_structure_status"),
      };
    });
  }, [rows]);

  return (
    <Panel title="SMC MAP / TRADINGVIEW PLAN" right="OBSERVER ONLY">
      {empty ? (
        <Waiting />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {SYMBOLS.map((sym) => (
              <SymbolCard key={sym} symbol={sym} raw={perSymbol[sym]} />
            ))}
          </div>

          <div className="mt-3 border-t border-black pt-2">
            <div className="text-[10px] uppercase tracking-wider opacity-80 mb-1">Latest SMC Decisions</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-black text-left uppercase tracking-wider">
                    <th className="py-1 pr-2">Time</th>
                    <th className="pr-2">Symbol</th>
                    <th className="pr-2">Dir</th>
                    <th className="pr-2">Score</th>
                    <th className="pr-2">Status</th>
                    <th className="pr-2">Reason</th>
                    <th className="pr-2">Setups</th>
                    <th className="pr-2">MTFA</th>
                    <th className="pr-2">MTF Struct</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((t) => (
                    <tr key={t.id} className="border-b border-dashed border-black/40">
                      <td className="py-1 pr-2 pixel">{t.time ? new Date(t.time).toISOString().slice(11, 19) : "—"}</td>
                      <td className="pr-2">{t.symbol}</td>
                      <td className="pr-2">{fmt(t.direction)}</td>
                      <td className="pr-2 pixel">{t.score ?? "—"}</td>
                      <td className="pr-2">{fmt(t.status)}</td>
                      <td className="pr-2 italic opacity-80 max-w-[260px] truncate">{fmt(t.reason)}</td>
                      <td className="pr-2">{t.setups}</td>
                      <td className="pr-2">{fmt(t.mtfa)}</td>
                      <td className="pr-2">{fmt(t.mtf_structure)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-2 border border-dashed border-black/60 p-2 text-[10px] uppercase tracking-widest text-center">
            ⚠ SMC Map is observational only. It does not approve, block, or execute trades.
          </div>
        </>
      )}
    </Panel>
  );
}
